// frontend/src/utils/api.ts - MongoDB Atlas 專用版
import { TestResults } from '../types/testTypes';

// API 基礎 URL 配置
const API_BASE_URL = 'http://localhost:5000/api';

// 定義測試結果資料介面
interface TestResultData {
  testResults: TestResults;
  dScore: number;
  biasType: string | null;
  biasLevel: string;
  biasDirection?: string;
  d1Score?: number;
  d2Score?: number;
  d3Score?: number;
  d4Score?: number;
  surveyResponses?: Record<string, any>;
}

/**
 * 測試 MongoDB Atlas 連接
 * @returns Promise<boolean>
 */
export async function testAtlasConnection(): Promise<boolean> {
  try {
    console.log('🔍 測試 MongoDB Atlas 連接...');
    const response = await fetch(`${API_BASE_URL}/test-atlas`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Atlas 連接測試通過:', result);
      console.log('📊 資料庫:', result.database);
      console.log('🏢 叢集:', result.cluster);
      return true;
    } else {
      const errorResult = await response.json().catch(() => null);
      console.error('❌ Atlas 連接測試失敗:', errorResult || response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Atlas 連接測試錯誤:', error);
    return false;
  }
}

/**
 * 檢查 API 連接狀態
 * @returns Promise<boolean>
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    console.log('🔍 檢查 API 連接狀態...');
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ API 健康檢查通過:', result);
      return true;
    } else {
      console.warn('⚠️  API 健康檢查失敗:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ API 健康檢查錯誤:', error);
    return false;
  }
}

/**
 * 儲存測試結果到 MongoDB Atlas
 * @param data 測試結果資料
 * @returns Promise<any>
 */
export async function saveTestResults(data: TestResultData): Promise<any> {
  try {
    // 產生或獲取用戶 ID
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('userId', userId);
      console.log('🆔 生成新的用戶 ID:', userId);
    } else {
      console.log('🆔 使用現有用戶 ID:', userId);
    }
    
    // 收集裝置資訊
    const deviceInfo = {
      browser: navigator.userAgent,
      language: navigator.language,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: navigator.platform
    };
    
    // 準備要發送的資料
    const payload = {
      userId,
      testDate: new Date().toISOString(),
      results: {
        maleComputer: data.testResults.maleComputer,
        femaleSkincare: data.testResults.femaleSkincare,
        femaleComputer: data.testResults.femaleComputer,
        maleSkincare: data.testResults.maleSkincare
      },
      analysis: {
        dScore: data.dScore,
        biasType: data.biasType,
        biasLevel: data.biasLevel,
        biasDirection: data.biasDirection,
        d1Score: data.d1Score,
        d2Score: data.d2Score,
        d3Score: data.d3Score,
        d4Score: data.d4Score
      },
      surveyResponses: data.surveyResponses || {},
      deviceInfo
    };
    
    console.log('🚀 正在儲存測試結果到 MongoDB Atlas...');
    console.log('📊 API URL:', `${API_BASE_URL}/test-results`);
    console.log('📋 資料摘要:', {
      userId,
      testResultsLength: {
        maleComputer: payload.results.maleComputer.length,
        femaleSkincare: payload.results.femaleSkincare.length,
        femaleComputer: payload.results.femaleComputer.length,
        maleSkincare: payload.results.maleSkincare.length
      },
      dScore: payload.analysis.dScore,
      biasLevel: payload.analysis.biasLevel
    });
    
    // 先檢查 API 連接
    console.log('1️⃣ 檢查 API 服務...');
    const isApiHealthy = await checkApiHealth();
    if (!isApiHealthy) {
      throw new Error('後端 API 服務無法連接，請確認伺服器是否在 http://localhost:5000 運行');
    }

    // 測試 Atlas 連接
    console.log('2️⃣ 檢查 MongoDB Atlas 連接...');
    const isAtlasConnected = await testAtlasConnection();
    if (!isAtlasConnected) {
      throw new Error('MongoDB Atlas 無法連接，請檢查：\n• 網路連接\n• Atlas IP 白名單設定\n• 叢集狀態');
    }
    
    console.log('3️⃣ 開始儲存資料...');
    const response = await fetch(`${API_BASE_URL}/test-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      console.error('❌ Atlas 儲存失敗:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      
      if (response.status === 400) {
        throw new Error(`資料驗證失敗: ${errorData.message || '請檢查資料格式'}`);
      } else if (response.status === 409) {
        throw new Error(`重複資料: ${errorData.message || '此測試結果已存在'}`);
      } else if (response.status === 503) {
        throw new Error(`Atlas 連接失敗: ${errorData.message || 'MongoDB Atlas 服務不可用'}`);
      } else {
        throw new Error(`Atlas 儲存錯誤 (${response.status}): ${errorData.message || response.statusText}`);
      }
    }
    
    const result = await response.json();
    console.log('✅ 測試結果已成功儲存到 MongoDB Atlas!');
    console.log('📊 儲存結果:', result);
    
    // 驗證儲存結果
    if (result.success && result.data && result.data.id) {
      console.log('🆔 Atlas 記錄 ID:', result.data.id);
      console.log('📅 儲存時間:', result.data.createdAt);
      console.log('👤 用戶 ID:', result.data.userId);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Atlas 儲存失敗:', error);
    
    // 根據錯誤類型提供更詳細的錯誤訊息
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('網路連接失敗，請檢查：\n• 後端伺服器是否在 http://localhost:5000 運行\n• 本地網路連接是否正常');
    } else if (error instanceof Error) {
      throw new Error(`Atlas 儲存失敗: ${error.message}`);
    } else {
      throw new Error('未知錯誤，請稍後再試');
    }
  }
}

/**
 * 取得測試結果統計
 * @returns Promise<any>
 */
export async function getTestResultsStats(): Promise<any> {
  try {
    console.log('📊 從 Atlas 取得測試結果統計...');
    const response = await fetch(`${API_BASE_URL}/test-results/count/all`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Atlas 統計資料取得成功:', result);
      return result;
    } else {
      console.error('❌ 取得 Atlas 統計失敗:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ 取得 Atlas 統計錯誤:', error);
    return null;
  }
}

/**
 * 手動測試 Atlas 連接 (供開發除錯使用)
 */
export async function debugAtlasConnection(): Promise<void> {
  console.log('🔧 開始 Atlas 連接除錯...');
  
  try {
    console.log('1️⃣ 測試基本 API...');
    const apiResponse = await fetch(`${API_BASE_URL}`, { method: 'GET' });
    if (apiResponse.ok) {
      const apiData = await apiResponse.json();
      console.log('✅ 基本 API 正常:', apiData);
    } else {
      console.error('❌ 基本 API 失敗:', apiResponse.status);
      return;
    }

    console.log('2️⃣ 測試健康檢查...');
    const healthCheck = await checkApiHealth();
    if (!healthCheck) {
      console.error('❌ 健康檢查失敗');
      return;
    }

    console.log('3️⃣ 測試 Atlas 連接...');
    const atlasCheck = await testAtlasConnection();
    if (!atlasCheck) {
      console.error('❌ Atlas 連接失敗');
      return;
    }

    console.log('4️⃣ 測試統計 API...');
    const stats = await getTestResultsStats();
    if (stats) {
      console.log('✅ 統計 API 正常:', stats);
    }

    console.log('🎉 所有測試通過！Atlas 連接正常。');

  } catch (error) {
    console.error('❌ 除錯過程出錯:', error);
  }
}