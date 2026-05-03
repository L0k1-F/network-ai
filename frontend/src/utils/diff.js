/**
 * Compute LCS-based line diff between two arrays.
 * Returns array of { type: 'same'|'add'|'remove', value: string }
 */
export function computeDiff(oldLines, newLines) {
  const lcs = buildLCS(oldLines, newLines)
  const result = []
  let oi = 0, ni = 0, li = 0

  while (oi < oldLines.length || ni < newLines.length) {
    if (li < lcs.length && oi < oldLines.length && ni < newLines.length &&
        oldLines[oi] === lcs[li] && newLines[ni] === lcs[li]) {
      result.push({ type: 'same', value: oldLines[oi] })
      oi++; ni++; li++
    } else if (oi < oldLines.length && (li >= lcs.length || oldLines[oi] !== lcs[li])) {
      result.push({ type: 'remove', value: oldLines[oi] })
      oi++
    } else if (ni < newLines.length && (li >= lcs.length || newLines[ni] !== lcs[li])) {
      result.push({ type: 'add', value: newLines[ni] })
      ni++
    } else {
      // Fallback: advance both
      if (oi < oldLines.length && ni < newLines.length) {
        result.push({ type: 'same', value: newLines[ni] })
        oi++; ni++
      } else if (oi < oldLines.length) {
        result.push({ type: 'remove', value: oldLines[oi++] })
      } else if (ni < newLines.length) {
        result.push({ type: 'add', value: newLines[ni++] })
      }
    }
  }

  return result
}

function buildLCS(a, b) {
  const m = a.length, n = b.length
  // Use shorter dimension for memory
  const dp = new Array(n + 1).fill(0)
  const bt = new Array(m + 1)
  for (let i = 0; i <= m; i++) bt[i] = new Array(n + 1).fill(0)

  for (let i = 1; i <= m; i++) {
    let prev = 0
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev + 1
        bt[i][j] = 1 // diagonal
      } else if (dp[j] >= dp[j - 1]) {
        dp[j] = dp[j]
        bt[i][j] = 2 // up
      } else {
        dp[j] = dp[j - 1]
        bt[i][j] = 3 // left
      }
      prev = temp
    }
  }

  // Backtrack
  const result = []
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (bt[i][j] === 1) {
      result.unshift(a[i - 1])
      i--; j--
    } else if (bt[i][j] === 2) {
      i--
    } else {
      j--
    }
  }
  return result
}
