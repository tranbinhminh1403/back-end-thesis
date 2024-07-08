const express = require('express');
const { getProducts, getProductById, searchProducts } = require('../controllers/productsController');

//router obj
const router = express.Router();

//get all products
router.get('/list', getProducts);

// Get a specific product by ID
router.get('/detail/:id', getProductById);

// Search products
router.get('/search', searchProducts);

module.exports = router;
