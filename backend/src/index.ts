import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import testResultRoutes from './routes/testResults';

// 環境設定
dotenv.config();

// 創建 Express 應用
const app = express();

// 中間件
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Atlas 連接字串
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://f113156124:5sxaxnkpcVXdfCbw@huihui0.ps2xz32.mongodb.net/gender-bias-test?retryWrites=true&w=majority&appName=huihui0';

console.log('🔗 嘗試連接 MongoDB Atlas...');
console.log('📍 連接目標:', MONGO_URI.replace(/\/\/.*:.*@/, '//*****:*****@')); // 隱藏密碼

// 連接 MongoDB Atlas 的專用設定
const connectDB = async (): Promise<void> => {
  try {
    // MongoDB Atlas 專用連接選項
    await mongoose.connect(MONGO_URI, {
      // Atlas 必要設定
      retryWrites: true,
      w: 'majority',
      
      // 連接超時設定
      serverSelectionTimeoutMS: 10000, // 10秒
      socketTimeoutMS: 45000, // 45秒
      connectTimeoutMS: 10000, // 10秒
      
      // 其他穩定性設定
      maxPoolSize: 10, // 連接池大小
      minPoolSize: 1,
      maxIdleTimeMS: 30000, // 30秒後關閉閒置連接
    });
    console.log('✅ MongoDB Atlas 連接成功');
  } catch (error: any) {
    console.error('❌ MongoDB Atlas 連接失敗:', error.message);
    console.error('🔍 可能的解決方案:');
    console.error('   1. 檢查網路連接');
    console.error('   2. 檢查 MongoDB Atlas IP 白名單設定 (允許所有 IP: 0.0.0.0/0)');
    console.error('   3. 檢查用戶名和密碼是否正確');
    console.error('   4. 檢查資料庫名稱是否正確');
    console.error('   5. 檢查 Atlas 叢集是否處於活動狀態');
    
    // 顯示具體錯誤類型
    if (error.message.includes('authentication failed')) {
      console.error('🔐 認證失敗：請檢查用戶名和密碼');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('🌐 DNS 解析失敗：請檢查網路連接');
    } else if (error.message.includes('connection refused')) {
      console.error('🚫 連接被拒絕：請檢查 IP 白名單設定');
    }
    
    process.exit(1);
  }
};

// 監聽 MongoDB 連接事件
mongoose.connection.on('connected', () => {
  console.log('🔗 MongoDB Atlas 已連接');
  const dbName = mongoose.connection.db?.databaseName;
  if (dbName) {
    console.log(`📊 連接到資料庫: ${dbName}`);
    console.log(`🏢 叢集: huihui0.ps2xz32.mongodb.net`);
  }
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB Atlas 連接已斷開');
});

mongoose.connection.on('error', (err: Error) => {
  console.error('❌ MongoDB Atlas 連接錯誤:', err);
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB Atlas 已重新連接');
});

// 測試 Atlas 連接和寫入的路由
app.get('/api/test-atlas', async (req: Request, res: Response): Promise<void> => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    const dbName = mongoose.connection.db?.databaseName;
    
    if (!isConnected) {
      res.status(500).json({
        success: false,
        message: '資料庫未連接',
        connectionState: isConnected
      });
      return;
    }

    // 測試讀寫操作
    const testData = {
      test: true,
      timestamp: new Date(),
      message: 'MongoDB Atlas connection test',
      server: 'huihui0.ps2xz32.mongodb.net'
    };
    
    // 插入測試資料
    const insertResult = await mongoose.connection.db?.collection('atlas_connection_test').insertOne(testData);
    
    // 讀取剛插入的資料
    const readResult = await mongoose.connection.db?.collection('atlas_connection_test').findOne({ _id: insertResult?.insertedId });
    
    // 刪除測試資料
    await mongoose.connection.db?.collection('atlas_connection_test').deleteOne({ _id: insertResult?.insertedId });
    
    res.json({
      success: true,
      message: 'MongoDB Atlas 連接正常，讀寫測試成功',
      database: dbName,
      cluster: 'huihui0.ps2xz32.mongodb.net',
      connectionState: isConnected,
      testInsertId: insertResult?.insertedId,
      testReadSuccess: !!readResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ Atlas 測試失敗:', error);
    res.status(500).json({
      success: false,
      message: 'MongoDB Atlas 測試失敗',
      error: error.message,
      connectionState: mongoose.connection.readyState
    });
  }
});

// 測試資料庫連接的路由 (保留原有功能)
app.get('/api/test-db', async (req: Request, res: Response): Promise<void> => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    const dbName = mongoose.connection.db?.databaseName;
    
    if (isConnected) {
      // 測試寫入操作
      const testData = {
        test: true,
        timestamp: new Date(),
        message: 'Database connection test'
      };
      
      // 嘗試創建一個測試集合
      await mongoose.connection.db?.collection('connection_test').insertOne(testData);
      
      res.json({
        success: true,
        message: '資料庫連接正常，可以正常讀寫',
        database: dbName,
        connectionState: isConnected,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: '資料庫未連接',
        connectionState: isConnected
      });
    }
  } catch (error: any) {
    console.error('❌ 資料庫測試失敗:', error);
    res.status(500).json({
      success: false,
      message: '資料庫測試失敗',
      error: error.message
    });
  }
});

// 註冊路由
app.use('/api/test-results', testResultRoutes);

// 基本路由
app.get('/api', (req: Request, res: Response): void => {
  const dbStatus = mongoose.connection.readyState === 1 ? '已連接' : '未連接';
  const dbName = mongoose.connection.db?.databaseName || '未知';
  res.json({
    message: '性別與商品偏見測試 API 正常運作中',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    databaseName: dbName,
    cluster: 'MongoDB Atlas - huihui0.ps2xz32.mongodb.net'
  });
});

// 健康檢查路由
app.get('/api/health', (req: Request, res: Response): void => {
  const isConnected = mongoose.connection.readyState === 1;
  const dbName = mongoose.connection.db?.databaseName || '未知';
  
  res.json({
    status: 'OK',
    database: isConnected ? '正常' : '異常',
    databaseName: dbName,
    cluster: 'huihui0.ps2xz32.mongodb.net',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: {
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    }
  });
});

// 錯誤處理中間件
app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('❌ 伺服器錯誤:', err);
  res.status(500).json({
    message: '伺服器內部錯誤',
    error: process.env.NODE_ENV === 'development' ? err.message : '伺服器錯誤'
  });
});

// 404 處理
app.use('*', (req: Request, res: Response): void => {
  res.status(404).json({
    message: '找不到請求的資源',
    path: req.originalUrl
  });
});

// 啟動函數
const startServer = async (): Promise<void> => {
  try {
    // 先連接資料庫
    await connectDB();
    
    // 再啟動伺服器
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 伺服器運行於 http://localhost:${PORT}`);
      console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🧪 測試 Atlas 連接: http://localhost:${PORT}/api/test-atlas`);
      console.log(`🧪 測試資料庫: http://localhost:${PORT}/api/test-db`);
    });
  } catch (error) {
    console.error('❌ 啟動伺服器失敗:', error);
    process.exit(1);
  }
};

// 優雅關閉處理
process.on('SIGINT', async (): Promise<void> => {
  console.log('\n🛑 收到 SIGINT 信號，正在關閉伺服器...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB Atlas 連接已關閉');
    process.exit(0);
  } catch (error) {
    console.error('❌ 關閉過程中發生錯誤:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async (): Promise<void> => {
  console.log('\n🛑 收到 SIGTERM 信號，正在關閉伺服器...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB Atlas 連接已關閉');
    process.exit(0);
  } catch (error) {
    console.error('❌ 關閉過程中發生錯誤:', error);
    process.exit(1);
  }
});

// 啟動伺服器
startServer();