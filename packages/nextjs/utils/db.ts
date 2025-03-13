import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'nft_',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const connectToDatabase = async () => {
  try {
    return pool.getConnection();
  } catch (error) {
    console.error('Error getting database connection from pool:', error);
    throw error;
  }
};
