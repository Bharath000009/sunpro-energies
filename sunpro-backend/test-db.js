require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  console.log('🔍 Testing MongoDB Connection...\n');
  
  try {
    console.log('Connection string:', process.env.MONGODB_URI.replace(/\/\/.*@/, '//***@'));
    
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ Connected successfully!');
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Test write
    const db = conn.connection.db;
    await db.collection('test').insertOne({ test: true, time: new Date() });
    console.log('✅ Write test passed');
    
    // Test read
    const result = await db.collection('test').findOne({ test: true });
    console.log('✅ Read test passed');
    
    // Clean up
    await db.collection('test').deleteMany({ test: true });
    console.log('✅ Delete test passed\n');
    
    console.log('🎉 All tests passed! Database is working perfectly.\n');
    
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Connection failed!\n');
    console.error('Error:', error.message);
    console.log('\n📋 Troubleshooting:');
    console.log('1. Check if username/password is correct');
    console.log('2. Check if cluster name is correct');
    console.log('3. Check if IP is whitelisted in MongoDB Atlas');
    console.log('4. Make sure to replace cluster0.xxxxx with your actual cluster\n');
    process.exit(1);
  }
}

testConnection();