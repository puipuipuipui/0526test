import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// 直接在這裡定義 Schema 和 Model，避免導入問題
const testResultSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    testDate: { type: Date, default: Date.now },
    results: {
        maleComputer: { type: [Number], default: [] },
        femaleSkincare: { type: [Number], default: [] },
        femaleComputer: { type: [Number], default: [] },
        maleSkincare: { type: [Number], default: [] }
    },
    analysis: {
        dScore: { type: Number, default: 0 },
        biasType: { type: String, default: null },
        biasLevel: { type: String, default: '' },
        biasDirection: { type: String, default: '' },
        d1Score: { type: Number, default: 0 },
        d2Score: { type: Number, default: 0 },
        d3Score: { type: Number, default: 0 },
        d4Score: { type: Number, default: 0 }
    },
    surveyResponses: { type: mongoose.Schema.Types.Mixed, default: {} },
    deviceInfo: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// 創建模型
const TestResult = mongoose.model('TestResult', testResultSchema);

// POST /api/test-results - 儲存測試結果
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('📥 收到測試結果儲存請求');
        console.log('📊 請求資料:', JSON.stringify(req.body, null, 2));
        
        // 檢查 MongoDB 連接狀態
        if (mongoose.connection.readyState !== 1) {
            console.error('❌ MongoDB 未連接，連接狀態:', mongoose.connection.readyState);
            res.status(503).json({
                success: false,
                message: 'MongoDB Atlas 未連接',
                error: 'DATABASE_NOT_CONNECTED',
                connectionState: mongoose.connection.readyState
            });
            return;
        }

        const {
            userId,
            testDate,
            results,
            analysis,
            surveyResponses,
            deviceInfo
        } = req.body;

        // 基本驗證
        if (!userId) {
            console.error('❌ 驗證失敗: 缺少用戶 ID');
            res.status(400).json({
                success: false,
                message: '缺少用戶 ID',
                error: 'MISSING_USER_ID'
            });
            return;
        }

        console.log('✅ 基本驗證通過，用戶 ID:', userId);

        // 準備資料，使用預設值避免驗證錯誤
        const testResultData = {
            userId,
            testDate: testDate ? new Date(testDate) : new Date(),
            results: {
                maleComputer: (results?.maleComputer || []).filter((time: number) => typeof time === 'number' && time > 0),
                femaleSkincare: (results?.femaleSkincare || []).filter((time: number) => typeof time === 'number' && time > 0),
                femaleComputer: (results?.femaleComputer || []).filter((time: number) => typeof time === 'number' && time > 0),
                maleSkincare: (results?.maleSkincare || []).filter((time: number) => typeof time === 'number' && time > 0)
            },
            analysis: {
                dScore: Number(analysis?.dScore) || 0,
                biasType: analysis?.biasType || null,
                biasLevel: analysis?.biasLevel || '無或極弱偏見',
                biasDirection: analysis?.biasDirection || '',
                d1Score: Number(analysis?.d1Score) || 0,
                d2Score: Number(analysis?.d2Score) || 0,
                d3Score: Number(analysis?.d3Score) || 0,
                d4Score: Number(analysis?.d4Score) || 0
            },
            surveyResponses: surveyResponses || {},
            deviceInfo: deviceInfo || {}
        };

        console.log('💾 準備儲存資料到 MongoDB Atlas...');
        console.log('📝 處理後的資料結構:', {
            userId: testResultData.userId,
            testDate: testResultData.testDate,
            resultsLength: {
                maleComputer: testResultData.results.maleComputer.length,
                femaleSkincare: testResultData.results.femaleSkincare.length,
                femaleComputer: testResultData.results.femaleComputer.length,
                maleSkincare: testResultData.results.maleSkincare.length
            },
            analysis: testResultData.analysis
        });

        // 嘗試創建並保存
        console.log('🔄 正在創建 MongoDB 文檔...');
        const newTestResult = new TestResult(testResultData);
        
        console.log('🔄 正在保存到 Atlas...');
        const savedResult = await newTestResult.save();
        
        console.log('✅ 儲存到 Atlas 成功！');
        console.log('🆔 MongoDB ID:', savedResult._id);
        console.log('👤 用戶 ID:', savedResult.userId);

        // 簡單驗證（可選）
        try {
            const verifyResult = await TestResult.findById(savedResult._id);
            if (verifyResult) {
                console.log('✅ 驗證: 資料已成功寫入 MongoDB Atlas');
            }
        } catch (verifyError) {
            console.warn('⚠️  驗證步驟失敗，但主要保存成功:', verifyError);
        }

        res.status(201).json({
            success: true,
            message: '測試結果儲存成功',
            data: {
                id: savedResult._id,
                userId: savedResult.userId,
                testDate: savedResult.testDate,
                createdAt: savedResult.createdAt
            }
        });

    } catch (error: any) {
        console.error('❌ 詳細儲存錯誤:', error);
        console.error('❌ 錯誤堆疊:', error.stack);
        
        // 具體的錯誤處理
        if (error.name === 'ValidationError') {
            console.error('📋 Mongoose 驗證錯誤:', error.errors);
            res.status(400).json({
                success: false,
                message: '資料驗證失敗',
                error: 'VALIDATION_ERROR',
                details: Object.keys(error.errors || {}).map(key => ({
                    field: key,
                    message: error.errors[key]?.message || 'Unknown validation error'
                }))
            });
            return;
        }

        if (error.code === 11000) {
            console.error('🔄 MongoDB 重複鍵錯誤:', error.keyValue);
            res.status(409).json({
                success: false,
                message: '重複的測試記錄',
                error: 'DUPLICATE_ENTRY',
                details: error.keyValue
            });
            return;
        }

        if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
            console.error('🌐 MongoDB Atlas 網路錯誤');
            res.status(503).json({
                success: false,
                message: 'MongoDB Atlas 連接失敗',
                error: 'ATLAS_CONNECTION_ERROR'
            });
            return;
        }

        // 其他未知錯誤
        res.status(500).json({
            success: false,
            message: '儲存失敗',
            error: 'ATLAS_SAVE_ERROR',
            details: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                name: error.name,
                code: error.code
            } : 'Internal server error'
        });
    }
});

// GET /api/test-results - 取得測試結果列表
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { page = 1, limit = 20, userId } = req.query;
        
        const filter: any = {};
        if (userId) {
            filter.userId = userId;
        }
        
        const skip = (Number(page) - 1) * Number(limit);
        
        console.log('📋 查詢測試結果列表...');
        
        const results = await TestResult.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .select('-surveyResponses -deviceInfo');
        
        const total = await TestResult.countDocuments(filter);
        
        console.log(`✅ 找到 ${results.length} 筆結果，總共 ${total} 筆`);
        
        res.json({
            success: true,
            data: results,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
        
    } catch (error: any) {
        console.error('❌ 查詢錯誤:', error);
        res.status(500).json({
            success: false,
            message: '查詢失敗',
            error: 'QUERY_ERROR'
        });
    }
});

// GET /api/test-results/:id - 取得特定測試結果
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        
        console.log('🔍 查詢特定測試結果:', id);
        
        const result = await TestResult.findById(id);
        
        if (!result) {
            res.status(404).json({
                success: false,
                message: '找不到指定的測試結果'
            });
            return;
        }
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error: any) {
        console.error('❌ 查詢特定結果錯誤:', error);
        res.status(500).json({
            success: false,
            message: '查詢失敗',
            error: 'QUERY_ERROR'
        });
    }
});

// GET /api/test-results/count/all - 取得統計
router.get('/count/all', async (req: Request, res: Response): Promise<void> => {
    try {
        const total = await TestResult.countDocuments();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = await TestResult.countDocuments({
            createdAt: { $gte: today }
        });

        console.log(`📊 總測試數: ${total}，今日測試數: ${todayCount}`);

        res.json({
            success: true,
            data: {
                total,
                today: todayCount
            }
        });
    } catch (error: any) {
        console.error('❌ 統計查詢錯誤:', error);
        res.status(500).json({
            success: false,
            message: '統計查詢失敗',
            error: 'STATS_ERROR'
        });
    }
});

export default router;