const express = require('express');
const { addProductToWishlist, getWishlistItems, removeProductFromWishlist } = require('../controllers/wishlistController');

const router = express.Router();

// Add product to wishlist
router.post('/add', addProductToWishlist);

// Get wishlist items for a user
router.get('/user/:userId', getWishlistItems);

// Remove product from wishlist
router.delete('/user/:userId/products/:productId', removeProductFromWishlist);

module.exports = router;
