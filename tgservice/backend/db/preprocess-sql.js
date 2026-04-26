/**
 * SQL 预处理器：统一处理字符串常量
 * 
 * 核心修复：正确处理字符串常量和原有参数占位符的混合顺序
 * 
 * 方法：使用临时标记代替字符串常量，替换后识别标记位置
 */

function preprocessSQL(sql, params = []) {
  // 正则表达式：匹配单引号或双引号包裹的字符串，支持转义引号
  const stringRegex = /(?:'(''|[^'])*')|(?:"(""|[^"])*")/g;
  
  // ========== 第一步：用临时标记替换字符串常量 ==========
  const extractedStrings = [];
  const MARKER_PREFIX = '__STR_';
  
  const markedSQL = sql.replace(stringRegex, (match, group1, group2, offset) => {
    const prefix = sql.substring(0, offset);
    
    // 排除 DEFAULT 值
    if (/\bDEFAULT\s*$/i.test(prefix)) {
      return match;
    }
    
    // 排除 AS 别名
    if (/\bAS\s*$/i.test(prefix)) {
      return match;
    }
    
    // 排除 CREATE TABLE 默认值
    if (prefix.includes('CREATE TABLE')) {
      const lastPart = prefix.substring(prefix.lastIndexOf('CREATE TABLE'));
      if (/\b(TEXT|INTEGER|DATETIME|REAL)\s+(DEFAULT|NOT\s+NULL)\b/i.test(lastPart)) {
        return match;
      }
    }
    
    // 提取字符串内容
    let actualContent = match;
    if (match.startsWith("'") && match.endsWith("'")) {
      actualContent = match.slice(1, -1).replace(/''/g, "'");
    } else if (match.startsWith('"') && match.endsWith('"')) {
      actualContent = match.slice(1, -1).replace(/""/g, '"');
    }
    
    // 用临时标记替换
    extractedStrings.push(actualContent);
    return MARKER_PREFIX + (extractedStrings.length - 1) + '__';
  });
  
  // ========== 第二步：找出所有占位符的位置和类型 ==========
  const placeholderInfo = [];
  
  // 找原有参数占位符 ?
  let searchPos = 0;
  while (true) {
    const idx = markedSQL.indexOf('?', searchPos);
    if (idx === -1) break;
    placeholderInfo.push({
      position: idx,
      type: 'original',
      paramIndex: placeholderInfo.filter(p => p.type === 'original').length
    });
    searchPos = idx + 1;
  }
  
  // 找字符串标记
  for (let i = 0; i < extractedStrings.length; i++) {
    const marker = MARKER_PREFIX + i + '__';
    searchPos = 0;
    while (true) {
      const idx = markedSQL.indexOf(marker, searchPos);
      if (idx === -1) break;
      placeholderInfo.push({
        position: idx,
        type: 'string',
        stringIndex: i
      });
      searchPos = idx + marker.length;
      break; // 每个标记只出现一次
    }
  }
  
  // ========== 第三步：按位置排序，构建参数数组 ==========
  placeholderInfo.sort((a, b) => a.position - b.position);
  
  const finalArgs = [];
  for (const info of placeholderInfo) {
    if (info.type === 'original') {
      if (info.paramIndex < params.length) {
        finalArgs.push(params[info.paramIndex]);
      } else {
        console.warn('[preprocessSQL] 原有参数数量不足');
        finalArgs.push(null);
      }
    } else {
      finalArgs.push(extractedStrings[info.stringIndex]);
    }
  }
  
  // ========== 第四步：替换标记为 ? ==========
  let finalSQL = markedSQL;
  for (let i = 0; i < extractedStrings.length; i++) {
    const marker = MARKER_PREFIX + i + '__';
    finalSQL = finalSQL.replace(marker, '?');
  }
  
  // 验证
  const finalPlaceholderCount = (finalSQL.match(/\?/g) || []).length;
  if (finalPlaceholderCount !== finalArgs.length) {
    console.warn('[preprocessSQL] 参数数量不匹配: SQL 需要 ' + finalPlaceholderCount + ' 个，实际 ' + finalArgs.length + ' 个');
  }
  
  return { sql: finalSQL, args: finalArgs };
}

module.exports = { preprocessSQL };