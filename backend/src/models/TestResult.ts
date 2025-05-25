import express, { Request, Response } from 'express';
import TestResult from '../models/TestResult';

const router = express.Router();

// 直接在這裡定義類型，避免導入問題
interface TestResultData {
    userId: string;
    testDate?: Date;
    results: {
        maleComputer: number[];
        femaleSkincare: number[];
        femaleComputer: number[];
        maleSkincare: number[];
    };
    analysis: {
        dScore: number;
        biasType: string | null;
        biasLevel: string;
        biasDirection?: string;
        d1Score?: number;
        d2Score?: number;
        d3Score?: number;
        d4Score?: number;
    };
    surveyResponses?: any;
    deviceInfo?: any;
}

// POST /api/test-results - 儲存測試結果
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('📥 收到測試結果儲存請求');
        console.log('📊 請求資料:', JSON.stringify(req.body, null, 2));
        
        const {
            userId,
            testDate,
            results,
            analysis,
            surveyResponses,
            deviceInfo
        } = req.body;

        // 詳細的資料驗證
        if (!userId) {
            console.error('❌ 驗證失敗: 缺少用戶 ID');
            res.status(400).json({
                success: false,
                message: '缺少用戶 ID',
                error: 'MISSING_USER_ID'
            });
            return;
        }

        if (!results) {
            console.error('❌ 驗證失敗: 缺少測試結果');
            res.status(400).json({
                success: false,
                message: '缺少測試結果',
                error: 'MISSING_RESULTS'
            });
            return;
        }

        if (!analysis) {
            console.error('❌ 驗證失敗: 缺少分析資料');
            res.status(400).json({
                success: false,
                message: '缺少分析資料',
                error: 'MISSING_ANALYSIS'
            });
            return;
        }

        // 驗證測試結果結構
        const requiredArrays = ['maleComputer', 'femaleSkincare', 'femaleComputer', 'maleSkincare'];
        for (const arrayName of requiredArrays) {
            if (!Array.isArray(results[arrayName])) {
                console.error(`❌ 驗證失敗: ${arrayName} 不是陣列`);
                res.status(400).json({
                    success: false,
                    message: `測試結果中的 ${arrayName} 必須是陣列`,
                    error: 'INVALID_RESULTS_STRUCTURE'
                });
                return;
            }
        }

        console.log('✅ 資料驗證通過');

        // 建立新的測試結果記錄
        const testResultData: TestResultData = {
            userId,
            testDate: testDate ? new Date(testDate) : new Date(),
            results: {
                maleComputer: results.maleComputer || [],
                femaleSkincare: results.femaleSkincare || [],
                femaleComputer: results.femaleComputer || [],
                maleSkincare: results.maleSkincare || []
            },
            analysis: {
                dScore: Number(analysis.dScore) || 0,
                biasType: analysis.biasType || null,
                biasLevel: analysis.biasLevel || '',
                biasDirection: analysis.biasDirection || '',
                d1Score: Number(analysis.d1Score) || 0,
                d2Score: Number(analysis.d2Score) || 0,
                d3Score: Number(analysis.d3Score) || 0,
                d4Score: Number(analysis.d4Score) || 0
            },
            surveyResponses: surveyResponses || {},
            deviceInfo: deviceInfo || {}
        };

        console.log('💾 準備儲存資料到 MongoDB Atlas...');
        console.log('📝 儲存的資料結構:', {
            userId: testResultData.userId,
            resultsLength: {
                maleComputer: testResultData.results.maleComputer.length,
                femaleSkincare: testResultData.results.femaleSkincare.length,
                femaleComputer: testResultData.results.femaleComputer.length,
                maleSkincare: testResultData.results.maleSkincare.length
            },
            analysis: testResultData.analysis
        });

        // 創建新實例
        const newTestResult = new (TestResult as any)(testResultData);
        const savedResult = await newTestResult.save();
        
        console.log('✅ 儲存到 Atlas 成功！');
        console.log('🆔 MongoDB ID:', savedResult._id);
        console.log('👤 用戶 ID:', savedResult.userId);

        // 驗證儲存是否成功
        const verifyResult = await (TestResult as any).findById(savedResult._id);
        if (verifyResult) {
            console.log('✅ 驗證: 資料已成功寫入 MongoDB Atlas');
        } else {
            console.error('❌ 驗證失敗: 無法從 Atlas 讀取剛儲存的資料');
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
        console.error('❌ 儲存測試結果錯誤:', error);
        
        // MongoDB 重複鍵錯誤
        if (error.code === 11000) {
            console.error('🔄 重複鍵錯誤詳情:', error.keyValue);
            res.status(409).json({
                success: false,
                message: '重複的測試記錄',
                error: 'DUPLICATE_ENTRY',
                details: error.keyValue
            });
            return;
        }
        
        // MongoDB 驗證錯誤
        if (error.name === 'ValidationError') {
            console.error('📋 驗證錯誤詳情:', error.errors);
            res.status(400).json({
                success: false,
                message: '資料驗證失敗',
                error: 'VALIDATION_ERROR',
                details: Object.keys(error.errors).map(key => ({
                    field: key,
                    message: error.errors[key].message
                }))
            });
            return;
        }

        // Atlas 連接錯誤
        if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
            console.error('🌐 MongoDB Atlas 連接錯誤');
            res.status(503).json({
                success: false,
                message: 'MongoDB Atlas 連接失敗',
                error: 'ATLAS_CONNECTION_ERROR'
            });
            return;
        }
        
        // 其他錯誤
        res.status(500).json({
            success: false,
            message: '伺服器內部錯誤',
            error: 'INTERNAL_SERVER_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/test-results - 取得測試結果列表（管理用途）
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { page = 1, limit = 20, userId } = req.query;
        
        const filter: any = {};
        if (userId) {
            filter.userId = userId;
        }
        
        const skip = (Number(page) - 1) * Number(limit);
        
        console.log('📋 從 Atlas 查詢測試結果列表...');
        console.log('🔍 查詢條件:', filter);
        
        const results = await (TestResult as any).find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .select('-surveyResponses -deviceInfo');
        
        const total = await (TestResult as any).countDocuments(filter);
        
        console.log(`✅ 從 Atlas 找到 ${results.length} 筆結果，總共 ${total} 筆`);
        
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
        console.error('❌ 從 Atlas 取得測試結果錯誤:', error);
        res.status(500).json({
            success: false,
            message: '伺服器內部錯誤',
            error: process.env.NODE_ENV === 'development' ? error.message : 'INTERNAL_SERVER_ERROR'
        });
    }
});

// GET /api/test-results/:id - 取得特定測試結果
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        
        console.log('🔍 從 Atlas 查詢特定測試結果:', id);
        
        const result = await (TestResult as any).findById(id);
        
        if (!result) {
            console.log('❌ 在 Atlas 中找不到指定的測試結果');
            res.status(404).json({
                success: false,
                message: '找不到指定的測試結果'
            });
            return;
        }
        
        console.log('✅ 在 Atlas 中找到測試結果');
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error: any) {
        console.error('❌ 從 Atlas 取得測試結果錯誤:', error);
        res.status(500).json({
            success: false,
            message: '伺服器內部錯誤',
            error: process.env.NODE_ENV === 'development' ? error.message : 'INTERNAL_SERVER_ERROR'
        });
    }
});

// GET /api/test-results/count/all - 取得總數統計
router.get('/count/all', async (req: Request, res: Response): Promise<void> => {
    try {
        const total = await (TestResult as any).countDocuments();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = await (TestResult as any).countDocuments({
            createdAt: { $gte: today }
        });

        console.log(`📊 Atlas 總測試數: ${total}，今日測試數: ${todayCount}`);

        res.json({
            success: true,
            data: {
                total,
                today: todayCount
            }
        });
    } catch (error: any) {
        console.error('❌ 從 Atlas 取得統計錯誤:', error);
        res.status(500).json({
            success: false,
            message: '伺服器內部錯誤',
            error: process.env.NODE_ENV === 'development' ? error.message : 'INTERNAL_SERVER_ERROR'
        });
    }
});

export default router;