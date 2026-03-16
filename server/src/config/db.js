import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set. Create server/.env from .env.example');
    }

    console.log(`[DB] Connecting to MongoDB at: ${process.env.MONGODB_URI.replace(/\/\/[^@]+@/, '//***@')}`);

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // fail fast if MongoDB is unreachable
    });

    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);

    // Log connection events for debugging
    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected');
    });

  } catch (error) {
    console.error('[DB] MongoDB connection error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('[DB] Is MongoDB running? Start it with: mongod --dbpath <path>');
    }
    process.exit(1);
  }
};
