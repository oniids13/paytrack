import passport from "passport";

/**
 * Middleware to protect routes - requires valid JWT
 */
export const protect = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Authentication error",
        error: err.message,
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: info?.message || "Not authorized, token required",
      });
    }

    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Middleware for optional authentication
 * Attaches user to request if token exists, but doesn't fail if not
 */
export const optionalAuth = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (user) {
      req.user = user;
    }
    next();
  })(req, res, next);
};
