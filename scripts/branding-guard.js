#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const MAX_FILE_SIZE = 2 * 1024 * 1024

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'web-build',
  'build',
  '.expo',
  '.turbo',
])

const IGNORE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.icns',
  '.svgz',
  '.mp4',
  '.mov',
  '.pdf',
  '.zip',
  '.gz',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
])

const BANNED_PATTERNS = [
  {name: 'Bluesky', regex: /\bBluesky\b/g},
  {name: 'Bsky', regex: /\bBsky\b/g},
  {name: 'bluesky.app', regex: /\bbluesky\.app\b/gi},
  {name: 'bsky.app', regex: /\bbsky\.app\b/gi},
  {name: 'bluesky.social', regex: /\bbluesky\.social\b/gi},
  {name: 'bsky.social', regex: /\bbsky\.social\b/gi},
]

const ALLOWED_LINE_PATTERNS = [
  // AT Protocol namespaces and technical identifiers.
  /\bapp\.bsky\./,
  /\bchat\.bsky\./,
  /\bgroup\.app\.bsky\b/,
  /\bxyz\.blueskyweb\.app\b/,
  /\bdid:web:(?:api|public\.api|video)\.bsky\.app\b/,
  /\b(api|public\.api|gifs|t\.gifs|video|events|ip|cardyb)\.bsky\.app\b/,
  /\bapi-bsky\.bitdrift\.io\b/,
  /\bX-Bsky-Topics\b/,
  /@haileyok\/bluesky-video/,
  /ExpoBluesky/,
  /expo-bluesky/,
  /\bShare-with-Bluesky\b/,
  /\bBlueskyNSE\b/,
  /\bBlueskyClip\b/,
  /Bluesky Social PBC/,
]

const ALLOWED_PATH_PATTERNS = [
  /[\\/]LICENSE$/,
  /[\\/]REBRAND_NOTES\.md$/,
  /[\\/]scripts[\\/]branding-guard\.js$/,
  /[\\/]junit\.xml$/,
]

const findings = []

function shouldIgnorePath(filePath) {
  return ALLOWED_PATH_PATTERNS.some(pattern => pattern.test(filePath))
}

function shouldIgnoreLine(line) {
  return ALLOWED_LINE_PATTERNS.some(pattern => pattern.test(line))
}

function isBinary(buffer) {
  return buffer.includes(0)
}

function scanFile(filePath) {
  if (shouldIgnorePath(filePath)) {
    return
  }
  const stat = fs.statSync(filePath)
  if (stat.size > MAX_FILE_SIZE) {
    return
  }
  const ext = path.extname(filePath).toLowerCase()
  if (IGNORE_EXTENSIONS.has(ext)) {
    return
  }
  const buffer = fs.readFileSync(filePath)
  if (isBinary(buffer)) {
    return
  }
  const content = buffer.toString('utf8')
  const lines = content.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (!line) {
      return
    }
    if (shouldIgnoreLine(line)) {
      return
    }
    BANNED_PATTERNS.forEach(pattern => {
      if (pattern.regex.test(line)) {
        findings.push({
          file: path.relative(ROOT, filePath),
          line: index + 1,
          pattern: pattern.name,
          text: line.trim(),
        })
      }
      pattern.regex.lastIndex = 0
    })
  })
}

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, {withFileTypes: true})
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue
      }
      walk(fullPath)
      continue
    }
    if (entry.isFile()) {
      scanFile(fullPath)
    }
  }
}

walk(ROOT)

if (findings.length > 0) {
  console.error('Branding guard failed. Remove or justify these references:')
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} [${finding.pattern}] ${finding.text}`,
    )
  }
  process.exit(1)
}

console.log('Branding guard passed.')
