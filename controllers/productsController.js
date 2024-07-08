const db = require('../config/db');
const { processName } = require('../utils/formatName');
const fuzzball = require('fuzzball');

// get all products
const getProducts = async (req, res) => {
    // Query to get all products with brand and shop information
    let productsQuery = `
        SELECT p.*, b.brand_name, s.shop_name 
        FROM products p 
        JOIN brand b ON p.brand_id = b._id 
        JOIN shop s ON p.shop_id = s._id
        WHERE p.img IS NOT NULL AND p.img <> '' -- Filter for products with img value
        ORDER BY p._id
    `;

    // Query to get all history records
    let historyQuery = `
        SELECT h.* 
        FROM history h
        ORDER BY h.product_id, h.created_at DESC
    `;

    try {
        // Execute the queries
        const [productsData] = await db.query(productsQuery);
        const [historyData] = await db.query(historyQuery);

        if (!productsData.length) {
            return res.status(404).send({
                success: false,
                message: 'No record found'
            });
        }

        // Create a map to store product histories
        const productHistories = historyData.reduce((acc, history) => {
            if (!acc[history.product_id]) {
                acc[history.product_id] = [];
            }
            acc[history.product_id].push({
                price: history.price,
                old_price: history.old_price,
                status: history.status,
                created_at: history.created_at
            });
            return acc;
        }, {});

        // Attach histories to products
        const productsWithHistory = productsData.map(product => ({
            ...product,
            history: productHistories[product._id] || []
        }));

        res.status(200).send({
            success: true,
            message: 'All products',
            totalProducts: productsWithHistory.length,
            data: productsWithHistory,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: 'Get products fail',
            error
        });
    }
};


// Get a specific product by ID
const getProductById = async (req, res) => {
    const { id } = req.params;
    try {
        const productData = await db.query(`
            SELECT p.*, b.brand_name 
            FROM products p 
            JOIN brand b ON p.brand_id = b._id 
            WHERE p._id = ?
        `, [id]);
        
        if (productData[0].length === 0) {
            return res.status(404).send({
                success: false,
                message: 'Product not found'
            });
        }

        const product = productData[0][0];
        product.processedName = processName(product.product_name); // Add validated_name to the product

        // Query price history for the main product
        const productHistoryData = await db.query(`
            SELECT h.price, h.old_price, h.status, h.created_at 
            FROM history h 
            WHERE h.product_id = ? 
            ORDER BY h.created_at DESC 
            LIMIT 10
        `, [id]);

        product.history = productHistoryData[0];

        // Query all product names
        const allProductsData = await db.query('SELECT _id, product_name FROM products');
        const allProducts = allProductsData[0];

        const targetNameProcessed = product.processedName;

        // Find the most similar products
        const similarProducts = allProducts
            .map(p => ({
                id: p._id,
                name: p.product_name,
                processedName: processName(p.product_name),
                ratio: fuzzball.ratio(targetNameProcessed, processName(p.product_name))
            }))
            .filter(p => p.id !== product._id && p.ratio > 90) // Exclude the current product and filter by ratio
            .sort((a, b) => b.ratio - a.ratio); // Sort by ratio in descending order

        // Query the details of similar products
        const similarProductIds = similarProducts.map(p => p.id);
        let similarProductsDetails = [];

        if (similarProductIds.length > 0) {
            const placeholders = similarProductIds.map(() => '?').join(',');
            const similarProductsData = await db.query(`
                SELECT p.*, b.brand_name 
                FROM products p 
                JOIN brand b ON p.brand_id = b._id 
                WHERE p._id IN (${placeholders})
            `, similarProductIds);
            similarProductsDetails = similarProductsData[0];
        }

        // Attach price history and processed name to similar products
        for (let i = 0; i < similarProductsDetails.length; i++) {
            const similarProductId = similarProductsDetails[i]._id;
            const similarProductHistoryData = await db.query(`
                SELECT h.price, h.old_price, h.status, h.created_at 
                FROM history h 
                WHERE h.product_id = ? 
                ORDER BY h.created_at DESC 
                LIMIT 10
            `, [similarProductId]);
            similarProductsDetails[i].history = similarProductHistoryData[0];
            similarProductsDetails[i].processedName = processName(similarProductsDetails[i].product_name); // Add validated_name
        }

        // Attach similarity ratio to similar products
        const similarProductsWithRatio = similarProductsDetails.map(product => {
            const similarProduct = similarProducts.find(p => p.id === product._id);
            return {
                ...product,
                ratio: similarProduct ? similarProduct.ratio : null
            };
        }).sort((a, b) => b.ratio - a.ratio); // Ensure the final list is sorted by ratio

        res.status(200).send({
            success: true,
            message: 'Product found',
            data: {
                product,
                similarProducts: similarProductsWithRatio
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: 'Get product fail',
            error
        });
    }
};



//search products
const searchProducts = async (req, res) => {
    const { name, brand, shop, specs, minPrice, maxPrice } = req.query;

    // Log the query parameters for debugging
    console.log('Search Query Parameters:', req.query);

    // Subquery to get the latest history entry for each product
    let query = `
        SELECT p.*, b.brand_name, s.shop_name, h.price, h.status 
        FROM products p 
        JOIN brand b ON p.brand_id = b._id 
        JOIN shop s ON p.shop_id = s._id 
        JOIN (
            SELECT h1.product_id, h1.price, h1.status
            FROM history h1
            JOIN (
                SELECT product_id, MAX(created_at) as latest_history 
                FROM history 
                GROUP BY product_id
            ) h2 ON h1.product_id = h2.product_id AND h1.created_at = h2.latest_history
        ) h ON p._id = h.product_id
        WHERE 1=1
          AND p.active = 1
          AND p.url IS NOT NULL AND p.url <> '' -- Filter for products with img value
    `;

    const queryParams = [];

    if (name) {
        query += " AND p.product_name LIKE ?";
        queryParams.push(`%${name}%`);
    }

    if (brand) {
        query += " AND b.brand_name = ?";
        queryParams.push(brand);
    }

    if (shop) {
        query += " AND s.shop_name = ?";
        queryParams.push(shop);
    }

    if (specs) {
        const specsArray = Array.isArray(specs) ? specs : [specs];
        query += " AND (" + specsArray.map(() => "p.specs LIKE ?").join(" AND ") + ")";
        specsArray.forEach(spec => queryParams.push(`%${spec}%`));
    }

    if (minPrice) {
        query += " AND h.price >= ?";
        queryParams.push(minPrice);
    }

    if (maxPrice) {
        query += " AND h.price <= ?";
        queryParams.push(maxPrice);
    }

    // Add the ORDER BY clause at the end
    query += " ORDER BY p.created_at asc";
    // query += " ORDER BY p.created_at";
    // Log the constructed query and parameters for debugging
    console.log('Constructed Query:', query);
    console.log('Query Parameters:', queryParams);

    try {
        const [data] = await db.query(query, queryParams); // Adjusted to use array destructuring to get the data array
        if (!data.length) {
            return res.status(404).send({
                success: false,
                message: 'No record found'
            });
        }
        res.status(200).send({
            success: true,
            message: 'All products',
            totalProducts: data.length,
            data: data,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: 'Get products fail',
            error
        });
    }
};



module.exports = {
    searchProducts
};


module.exports = { getProducts, getProductById, searchProducts };
