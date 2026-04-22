/**
 * 门迎排序服务
 * 管理每日助教门迎排序逻辑
 * 数据持久化到 system_config 表
 */

const { get, runInTransaction, enqueueRun } = require('../db');
const TimeUtil = require('../utils/time');

class GuestRankingService {
  constructor() {
    this._ranking = {};       // { coach_no: rank } 序号 1-100
    this._exempt = new Set(); // Set<coach_no> 免门迎清单
    this._date = '';          // 当前排序日期 "YYYY-MM-DD"
  }

  /**
   * 从 system_config 加载今日排序和免门迎清单到内存
   */
  async loadTodayData() {
    try {
      const today = TimeUtil.todayStr();

      const dateRow = await get(
        'SELECT value FROM system_config WHERE key = ?',
        ['today_guest_ranking_date']
      );

      if (dateRow && dateRow.value !== today) {
        // 跨天了，清空旧数据
        console.log('[GuestRanking] 检测到跨天，清空旧排序数据');
        await this._clearSystemConfig();
      }

      const rankingRow = await get(
        'SELECT value FROM system_config WHERE key = ?',
        ['today_guest_ranking']
      );
      if (rankingRow && rankingRow.value) {
        try {
          this._ranking = JSON.parse(rankingRow.value);
        } catch (e) {
          this._ranking = {};
        }
      }

      const exemptRow = await get(
        'SELECT value FROM system_config WHERE key = ?',
        ['today_guest_exempt']
      );
      if (exemptRow && exemptRow.value) {
        try {
          const arr = JSON.parse(exemptRow.value);
          this._exempt = new Set(arr);
        } catch (e) {
          this._exempt = new Set();
        }
      }

      this._date = today;
      console.log(`[GuestRanking] 加载今日数据: ranking=${Object.keys(this._ranking).length}条, exempt=${this._exempt.size}人`);
    } catch (err) {
      console.error('[GuestRanking] loadTodayData 失败:', err.message);
      this._ranking = {};
      this._exempt = new Set();
      this._date = TimeUtil.todayStr();
    }
  }

  /**
   * 持久化排序数据到 system_config
   */
  async _saveRanking() {
    const now = TimeUtil.nowDB();
    await enqueueRun(
      `INSERT INTO system_config (key, value, updated_at) VALUES ('today_guest_ranking', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
      [JSON.stringify(this._ranking), now, JSON.stringify(this._ranking), now]
    );
  }

  /**
   * 持久化免门迎清单到 system_config
   */
  async _saveExempt() {
    const now = TimeUtil.nowDB();
    const exemptArr = Array.from(this._exempt);
    await enqueueRun(
      `INSERT INTO system_config (key, value, updated_at) VALUES ('today_guest_exempt', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
      [JSON.stringify(exemptArr), now, JSON.stringify(exemptArr), now]
    );
  }

  /**
   * 更新日期标记
   */
  async _saveDate() {
    const now = TimeUtil.nowDB();
    await enqueueRun(
      `INSERT INTO system_config (key, value, updated_at) VALUES ('today_guest_ranking_date', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
      [this._date, now, this._date, now]
    );
  }

  /**
   * 清空 system_config 中的排序相关数据
   */
  async _clearSystemConfig() {
    const now = TimeUtil.nowDB();
    const keys = ['today_guest_ranking', 'today_guest_exempt', 'today_guest_ranking_date'];
    for (const key of keys) {
      if (key === 'today_guest_ranking_date') {
        await enqueueRun(
          `INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
          [key, this._date || TimeUtil.todayStr(), now, this._date || TimeUtil.todayStr(), now]
        );
      } else {
        await enqueueRun(
          `INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
          [key, key === 'today_guest_ranking' ? '{}' : '[]', now, key === 'today_guest_ranking' ? '{}' : '[]', now]
        );
      }
    }
  }

  /**
   * 批处理排序（14点/18点调用）
   * @param {string} shift - '早班' | '晚班'
   * @param {number} startRank - 起始序号（早班=1，晚班=51）
   * @param {number} maxRank - 最大序号（早班=50，晚班=100）
   */
  async batchRank(shift, startRank, maxRank) {
    // 检查并重置跨天数据
    await this.checkAndResetIfNewDay();

    const statusList = shift === '早班'
      ? ['早班空闲', '早班上桌']
      : ['晚班空闲', '晚班上桌'];

    const placeholders = statusList.map(() => '?').join(',');

    // 查询空闲/上桌助教
    const rows = await get(`
      SELECT wb.coach_no, wb.clock_in_time
      FROM water_boards wb
      WHERE wb.status IN (${placeholders})
      ORDER BY wb.clock_in_time DESC
    `, [...statusList]);

    // JS 过滤免门迎 + 分配序号
    let currentRank = startRank;
    const newRankings = {};

    // 删除旧数据中该班次范围的序号
    for (const key of Object.keys(this._ranking)) {
      const rank = this._ranking[key];
      if (rank >= startRank && rank <= maxRank) {
        delete this._ranking[key];
      }
    }

    for (const row of rows) {
      if (currentRank > maxRank) break;
      if (this._exempt.has(String(row.coach_no))) continue;

      this._ranking[String(row.coach_no)] = currentRank;
      newRankings[String(row.coach_no)] = currentRank;
      currentRank++;
    }

    await this._saveRanking();
    await this._saveDate();

    console.log(`[GuestRanking] batchRank ${shift}: 分配 ${Object.keys(newRankings).length} 人, 范围 ${startRank}-${currentRank - 1}`);

    return {
      shift,
      ranked_count: Object.keys(newRankings).length,
      rankings: newRankings
    };
  }

  /**
   * 打卡后排序
   * @param {string} coachNo - 打卡助教 coach_no
   * @param {string} shift - 班次
   */
  async afterClockRank(coachNo, shift) {
    await this.checkAndResetIfNewDay();

    const now = new Date(TimeUtil.nowDB() + '+08:00');
    const currentHour = now.getHours();

    // 只在排序时间段内触发
    if (shift === '早班' && currentHour < 14) return { rank: null, message: '未到早班排序时间' };
    if (shift === '晚班' && currentHour < 18) return { rank: null, message: '未到晚班排序时间' };

    const startRank = shift === '早班' ? 1 : 51;
    const maxRank = shift === '早班' ? 50 : 100;

    // 检查免门迎
    if (this._exempt.has(String(coachNo))) {
      return { rank: null, message: '该助教已设免门迎' };
    }

    // 检查当前状态是否为空闲/上桌
    const statusList = shift === '早班'
      ? ['早班空闲', '早班上桌']
      : ['晚班空闲', '晚班上桌'];
    const placeholders = statusList.map(() => '?').join(',');

    const wb = await get(
      `SELECT status FROM water_boards WHERE coach_no = ? AND status IN (${placeholders})`,
      [coachNo, ...statusList]
    );
    if (!wb) {
      return { rank: null, message: '助教状态不在空闲/上桌范围内' };
    }

    // 获取当前该班次最大序号
    let maxCurrentRank = startRank - 1;
    for (const key of Object.keys(this._ranking)) {
      const rank = this._ranking[key];
      if (rank >= startRank && rank <= maxRank && rank > maxCurrentRank) {
        maxCurrentRank = rank;
      }
    }

    const newRank = maxCurrentRank + 1;
    if (newRank > maxRank) {
      return { rank: null, message: '该班次序号已满' };
    }

    // 如果该助教已有旧序号，先删除
    delete this._ranking[String(coachNo)];

    this._ranking[String(coachNo)] = newRank;

    await this._saveRanking();
    await this._saveDate();

    return { rank: newRank, message: `已排到第${newRank}位` };
  }

  /**
   * 设置免门迎
   */
  async setExempt(coachNo) {
    // 从排序中移除
    delete this._ranking[String(coachNo)];
    // 加入免门迎清单
    this._exempt.add(String(coachNo));

    await this._saveRanking();
    await this._saveExempt();
    await this._saveDate();

    // 获取 stage_name
    const coach = await get('SELECT stage_name FROM coaches WHERE coach_no = ?', [coachNo]);
    return {
      coach_no: String(coachNo),
      stage_name: coach ? coach.stage_name : '',
      exempt: true
    };
  }

  /**
   * 取消免门迎
   */
  async removeExempt(coachNo) {
    this._exempt.delete(String(coachNo));

    await this._saveExempt();
    await this._saveDate();

    const coach = await get('SELECT stage_name FROM coaches WHERE coach_no = ?', [coachNo]);
    return {
      coach_no: String(coachNo),
      stage_name: coach ? coach.stage_name : '',
      exempt: false
    };
  }

  /**
   * 获取今日全部排序数据
   */
  async getTodayRanking() {
    await this.checkAndResetIfNewDay();
    return {
      date: this._date,
      ranking: { ...this._ranking },
      exempt: Array.from(this._exempt)
    };
  }

  /**
   * 获取某助教的门迎序号
   */
  getCoachRank(coachNo) {
    return this._ranking[String(coachNo)] || null;
  }

  /**
   * 判断某助教是否免门迎
   */
  isExempt(coachNo) {
    return this._exempt.has(String(coachNo));
  }

  /**
   * 午夜清空所有排序数据
   */
  async clearAll() {
    this._ranking = {};
    this._exempt = new Set();
    this._date = TimeUtil.todayStr();

    await this._clearSystemConfig();

    console.log('[GuestRanking] clearAll: 已清空所有排序数据');
    return { cleared: true };
  }

  /**
   * 检查是否需要跨天重置
   */
  async checkAndResetIfNewDay() {
    const today = TimeUtil.todayStr();
    if (this._date !== today) {
      await this.clearAll();
    }
  }
}

// 导出单例
module.exports = new GuestRankingService();
