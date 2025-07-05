const wishlistModel = require('../../models/wishlistSchema');
const productModel = require('../../models/productSchema');
const userModel = require('../../models/userSchema');
const cartModel = require('../../models/cartSchema')


const getWishlist = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect('/login'); // Redirect to login if user not authenticated
    }

    const user = await userModel.findById(userId); // e.g., { name: "Haris", email: "..." }
    const currentPage = "wishlist";

    // Find the wishlist and populate products + categories
    const wishlistDoc = await wishlistModel.findOne({ userId }).populate({
      path: 'product',
      populate: {
        path: 'category' // To access categoryOffer
      }
    });

    const wishlist = wishlistDoc
      ? wishlistDoc.product.map(product => {
          // Calculate effective discount
          const productDiscount = product.discount || 0;
          const categoryOffer = product.category?.categoryOffer || 0;
          const effectiveDiscount = Math.max(productDiscount, categoryOffer);

          return {
            _id: product._id,
            name: product.productName,
            price: product.price,
            stock: product.stock,
            discount: product.discount,
            effectiveDiscount: effectiveDiscount, // Add this field
            image: product.productImage[0] || "/images/default.jpg"
          };
        })
      : [];

    res.render("wishlist", { user, wishlist, currentPage });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    res.status(500).render("error", { message: "Failed to load wishlist." });
  }
};

const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    if (!userId) {
      return res.status(401).json({ status: false, message: "Not authenticated" });
    }

    let wishlist = await wishlistModel.findOne({ userId });

    if (!wishlist) {
      wishlist = new wishlistModel({
        userId,
        product: [productId]
      });
    } else {
      if (wishlist.product.includes(productId)) {
        // 💡 Still return current count
        return res.json({
          status: false,
          message: "Product is already in wishlist",
          wishlistCount: wishlist.product.length
        });
      }

      wishlist.product.push(productId);
    }

    await wishlist.save();

    // ✅ Return updated count
    res.json({
      status: true,
      message: "Product added to wishlist",
      wishlistCount: wishlist.product.length
    });

  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};


const removeProduct = async (req, res) => {
  try {
    const productId = req.query.productId;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ status: false, message: "Not authenticated" });
    }

    const wishlist = await wishlistModel.findOne({ userId });

    if (!wishlist) {
      return res.status(404).json({ status: false, message: "Wishlist not found" });
    }

    const index = wishlist.product.indexOf(productId);
    if (index === -1) {
      return res.status(404).json({ status: false, message: "Product not found in wishlist" });
    }

    wishlist.product.splice(index, 1); // remove the product
    await wishlist.save();

    res.json({ status: true, message: "Product removed from wishlist" });

  } catch (error) {
    console.error("Error removing product from wishlist:", error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

const moveToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const qty = parseInt(quantity) || 1;

    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let cart = await cartModel.findOne({ userId });

    if (!cart) {
      cart = new cartModel({
        userId,
        cartItems: [{
          productId,
          quantity: qty,
          price: product.price,
          totalPrice: product.price * qty
        }]
      });
    } else {
      const itemIndex = cart.cartItems.findIndex(item => item.productId.toString() === productId);

      if (itemIndex > -1) {
        const existingItem = cart.cartItems[itemIndex];
        existingItem.quantity += qty;
        existingItem.totalPrice = existingItem.quantity * product.price;
      } else {
        cart.cartItems.push({
          productId,
          quantity: qty,
          price: product.price,
          totalPrice: product.price * qty
        });
      }
    }

    await cart.save();

    // ✅ Remove product from wishlist
    const wishlist = await wishlistModel.findOne({ userId });
    if (wishlist) {
      wishlist.product = wishlist.product.filter(
        (id) => id.toString() !== productId
      );
      await wishlist.save();
    }

    return res.json({ success: true, message: 'Moved to cart and removed from wishlist' });
  } catch (err) {
    console.error("moveToCart error:", err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


module.exports = {
    getWishlist,
    addToWishlist,
    removeProduct,
    moveToCart
}
