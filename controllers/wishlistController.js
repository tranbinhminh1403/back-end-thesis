const db = require('../config/db');

// Add product to wishlist
const addProductToWishlist = async (req, res) => {
    const { userId, productId } = req.body;

    try {
        // Check if the user has a wishlist
        const [wishlistResult] = await db.query('SELECT _id FROM wishlist WHERE user_id = ?', [userId]);
        let wishlistId;

        if (wishlistResult.length === 0) {
            // If no wishlist exists, create one
            const [createWishlistResult] = await db.query('INSERT INTO wishlist (user_id, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())', [userId, `newlist_${userId}`]);
            wishlistId = createWishlistResult.insertId;
        } else {
            wishlistId = wishlistResult[0]._id;
        }

        // Check if the product is already in the wishlist
        const [existingProduct] = await db.query('SELECT * FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?', [wishlistId, productId]);
        if (existingProduct.length > 0) {
            return res.status(400).send({
                success: false,
                message: 'Product already in wishlist'
            });
        }

        // Add product to the wishlist
        const [addProductResult] = await db.query('INSERT INTO wishlist_items (wishlist_id, product_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())', [wishlistId, productId]);
        
        res.status(201).send({
            success: true,
            message: 'Product added to wishlist',
            data: addProductResult
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            success: false,
            message: 'Failed to add product to wishlist',
            error
        });
    }
};

// Get wishlist items for a user
const getWishlistItems = async (req, res) => {
    const { userId } = req.params;

    try {
        const [wishlistResult] = await db.query('SELECT _id FROM wishlist WHERE user_id = ?', [userId]);
        if (wishlistResult.length === 0) {
            return res.status(404).send({
                success: false,
                message: 'Wishlist not found for the user'
            });
        }

        const wishlistId = wishlistResult[0]._id;

        const [wishlistItems] = await db.query(`
            SELECT 
                wi.product_id, 
                p.product_name, 
                p.img, 
                p.url, 
                p.shop_id, 
                p.brand_id, 
                p.category_id, 
                p.specs, 
                p.active,
                h.price, 
                h.old_price, 
                h.status, 
                h.created_at AS price_history_date
            FROM wishlist_items wi
            JOIN products p ON wi.product_id = p._id
            LEFT JOIN history h ON p._id = h.product_id
            WHERE wi.wishlist_id = ?
            ORDER BY h.created_at DESC
        `, [wishlistId]);

        const productsMap = {};

        wishlistItems.forEach(item => {
            if (!productsMap[item.product_id]) {
                productsMap[item.product_id] = {
                    productId: item.product_id,
                    productName: item.product_name,
                    img: item.img,
                    url: item.url,
                    shopId: item.shop_id,
                    brandId: item.brand_id,
                    categoryId: item.category_id,
                    specs: item.specs,
                    active: item.active,
                    history: []
                };
            }

            if (item.price) {
                productsMap[item.product_id].history.push({
                    price: item.price,
                    oldPrice: item.old_price,
                    status: item.status,
                    date: item.price_history_date
                });
            }
        });

        const productsList = Object.values(productsMap);

        res.status(200).send({
            success: true,
            data: productsList
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            success: false,
            message: 'Failed to fetch wishlist items',
            error
        });
    }
};

// Remove product from wishlist
const removeProductFromWishlist = async (req, res) => {
    const { userId, productId } = req.params;

    try {
        // Get the wishlist id for the user
        const [wishlistResult] = await db.query('SELECT _id FROM wishlist WHERE user_id = ?', [userId]);
        if (wishlistResult.length === 0) {
            return res.status(404).send({
                success: false,
                message: 'Wishlist not found for the user'
            });
        }

        const wishlistId = wishlistResult[0]._id;

        // Remove the product from the wishlist
        await db.query('DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?', [wishlistId, productId]);

        res.status(200).send({
            success: true,
            message: 'Product removed from wishlist'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            success: false,
            message: 'Failed to remove product from wishlist',
            error
        });
    }
};

module.exports = { addProductToWishlist, getWishlistItems, removeProductFromWishlist };
