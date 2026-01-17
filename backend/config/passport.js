import "dotenv/config";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth2";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import User from "../models/User.js";

// Local Strategy - Email/Password authentication
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        // Find user and include password field
        const user = await User.findOne({ email }).select("+password");

        if (!user) {
          return done(null, false, { message: "Invalid email or password" });
        }

        // Check if user has a password (might be Google-only user)
        if (!user.password) {
          return done(null, false, {
            message: "Please login with Google or set a password",
          });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid email or password" });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Check if this is a linking request (user is already authenticated)
        const linkingUserId = req.query.state;

        if (linkingUserId) {
          // Linking flow - user wants to add Google to existing account
          return await handleGoogleLinking(linkingUserId, profile, done);
        }

        // Normal login/register flow
        return await handleGoogleAuth(profile, done);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Handle normal Google authentication (login or register)
async function handleGoogleAuth(profile, done) {
  const { id: googleId, email, displayName, picture } = profile;

  // First, check if user exists with this Google ID
  let user = await User.findOne({ googleId });

  if (user) {
    return done(null, user);
  }

  // Check if user exists with this email
  user = await User.findOne({ email });

  if (user) {
    // Link Google account to existing user
    user.googleId = googleId;
    user.avatar = user.avatar || picture;
    user.authProvider = user.authProvider === "local" ? "both" : user.authProvider;
    await user.save();
    return done(null, user);
  }

  // Create new user with Google
  user = await User.create({
    name: displayName,
    email,
    googleId,
    avatar: picture,
    authProvider: "google",
  });

  return done(null, user);
}

// Handle Google account linking to existing user
async function handleGoogleLinking(userId, profile, done) {
  const { id: googleId, picture } = profile;

  // Check if this Google account is already linked to another user
  const existingGoogleUser = await User.findOne({ googleId });
  if (existingGoogleUser && existingGoogleUser._id.toString() !== userId) {
    return done(null, false, {
      message: "This Google account is already linked to another user",
    });
  }

  // Find and update the user who wants to link
  const user = await User.findById(userId);
  if (!user) {
    return done(null, false, { message: "User not found" });
  }

  user.googleId = googleId;
  user.avatar = user.avatar || picture;
  user.authProvider = user.authProvider === "local" ? "both" : user.authProvider;
  await user.save();

  return done(null, user);
}

// JWT Strategy - Token authentication for protected routes
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (jwtPayload, done) => {
      try {
        const user = await User.findById(jwtPayload.id);

        if (!user) {
          return done(null, false);
        }

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

export default passport;
