/**
 * SQL 预处理器：统一处理字符串常量
 * 
 * 目的：将 SQL 中的字符串常量转换为参数化查询
 * - 本地 SQLite：支持字符串常量，预处理后也能正常工作
 * - Turso 云端：不支持字符串常量，预处理后转为参数化查询
 * 
 * 支持：
 * - 中文字符串（"灯"、"空调"、"早班空闲"）
 * - 空字符串（""、''）
 * - 转义引号（'O''Brien'、"he said ""hello"""）
 * 
 * 排除：
 * - DEFAULT 值（DEFAULT 'xxx'）
 * - AS 别名（SELECT col AS '别名'）
 * - CREATE TABLE 中的默认值定义
 */

/**
 * 预处理 SQL：将字符串常量转换为参数化查询
 * 
 * @param {string} sql - 原始 SQL
 * @param {Array} params - 原有参数
 * @returns {Object} { sql, args } - 处理后的 SQL 和参数
 */
function preprocessSQL(sql, params = []) {
  // 正则表达式：匹配单引号或双引号包裹的字符串，支持转义引号
  // SQLite 转义规则：单引号转义为两个单引号 'O''Brien'
  // 使用非捕获组 (?:...) 避免 replace 回调参数混乱
  const stringRegex = /(?:'(''|[^'])*')|(?:"(""|[^"])*")/g;
  
  const extractedStrings = [];
  
  // 替换字符串常量为 ?
  const processedSQL = sql.replace(stringRegex, (match, quote, content, offset) => {
    // 检查前面的内容，排除 DEFAULT 值和 AS 别名
    // 使用正则检测更健壮，支持换行符和多空格
    const prefix = sql.substring(0, offset);
    
    // 检测 DEFAULT 值：DEFAULT 后面可能有空格，然后是引号
    // 例如: DEFAULT '值' 或 DEFAULT  "值"
    if (/\bDEFAULT\s*$/i.test(prefix)) {
      return match; // 保持原样
    }
    
    // 检测 AS 别名：AS 后面可能有空格，然后是引号
    // 例如: SELECT col AS '别名' 或 AS "别名"
    if (/\bAS\s*$/i.test(prefix)) {
      return match; // 保持原样
    }
    
    // 检测 CREATE TABLE 中的默认值定义
    if (prefix.includes('CREATE TABLE')) {
      // 提取 CREATE TABLE 之后的部分
      const lastPart = prefix.substring(prefix.lastIndexOf('CREATE TABLE'));
      // 检测是否是类型定义后的 DEFAULT 值
      // 支持 TEXT、INTEGER、DATETIME、REAL 类型
      if (/\b(TEXT|INTEGER|DATETIME|REAL)\s+(DEFAULT|NOT\s+NULL)\b/i.test(lastPart)) {
        return match; // 保持原样
      }
    }
    
    // 提取字符串内容（去除引号）
    // 对于转义引号，需要还原：'' → '，"" → "
    let actualContent = match;
    if (match.startsWith("'") && match.endsWith("'")) {
      actualContent = match.slice(1, -1).replace(/''/g, "'");
    } else if (match.startsWith('"') && match.endsWith('"')) {
      actualContent = match.slice(1, -1).replace(/""/g, '"');
    }
    
    extractedStrings.push(actualContent);
    return '?';
  });
  
  // 如果没有提取到字符串，直接返回原 SQL
  if (extractedStrings.length === 0) {
    return { sql, args: params };
  }
  
  // 合并参数：原有参数 + 提取的字符串
  const finalArgs = [...params, ...extractedStrings];
  
  // 验证参数数量（可选警告）
  const originalPlaceholderCount = (processedSQL.match(/\?/g) || []).length;
  if (originalPlaceholderCount !== finalArgs.length) {
    console.warn('[preprocessSQL] 参数数量不匹配: SQL 需要 ' + originalPlaceholderCount + ' 个，实际 ' + finalArgs.length + ' 个');
  }
  
  return { sql: processedSQL, args: finalArgs };
}

module.exports = { preprocessSQL };