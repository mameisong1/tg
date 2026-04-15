/**
 * 管理端北京时间工具
 * 用于 admin HTML 页面
 */
const TimeUtil = {
    /** 当前北京时间 "YYYY-MM-DD" */
    today() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    /** 当前北京时间 "YYYY-MM-DD HH:MM:SS" */
    now() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    },
    /** 格式化显示（截取到分钟） */
    format(timeStr) {
        if (!timeStr) return '-';
        return timeStr.replace('T', ' ').substring(0, 16);
    },
    /** 计算小时差（向上取整） */
    calcHours(startTime, endTime) {
        if (!startTime || !endTime) return '-';
        const start = new Date(startTime + '+08:00');
        const end = new Date(endTime + '+08:00');
        return Math.ceil((end - start) / (60 * 60 * 1000));
    }
};
