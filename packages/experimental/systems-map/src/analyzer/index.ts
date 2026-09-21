import * as ts from 'typescript'
import { AccessSite, AccessSiteType, Layer } from '../models/index.js'

export interface AnalysisResult {
  accessSites: AccessSite[]
  coveragePct: number
}

export class StaticAnalyzer {
  private accessSites: AccessSite[] = []
  private analyzedNodes = 0
  private totalNodes = 0


  public analyzeFile(filePath: string, fileContent: string): void {
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true,
    )

    this.visitNode(sourceFile, sourceFile, false)
  }

  public getResult(): AnalysisResult {
    const coveragePct = this.totalNodes === 0 ? 100 : Math.round((this.analyzedNodes / this.totalNodes) * 100)
    return {
      accessSites: this.accessSites,
      coveragePct,
    }
  }

  private visitNode(node: ts.Node, sourceFile: ts.SourceFile, inLoop: boolean): void {
    this.totalNodes++

    // Check if we are entering a loop
    const isLoop =
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)

    const currentInLoop = inLoop || isLoop

    if (ts.isCallExpression(node)) {
      const site = this.analyzeCallExpression(node, sourceFile, currentInLoop)
      if (site) {
        this.accessSites.push(site)
      }
    }

    if (!ts.isIdentifier(node) && !ts.isStringLiteral(node)) {
      this.analyzedNodes++
    } else {
      this.totalNodes--
    }

    ts.forEachChild(node, child => this.visitNode(child, sourceFile, currentInLoop))
  }

  private analyzeCallExpression(node: ts.CallExpression, sourceFile: ts.SourceFile, inLoop: boolean): AccessSite | null {
    const expression = node.expression
    let name = ''

    if (ts.isPropertyAccessExpression(expression)) {
      name = expression.name.text
    } else if (ts.isIdentifier(expression)) {
      name = expression.text
    }

    if (!name) return null

    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart())
    const line = lineAndChar.line + 1

    let type: AccessSiteType | null = null
    let layer: Layer | null = null
    let detectedLibrary: string | undefined = undefined

    if (name === 'query' || name === 'find' || name === 'findOne' || name === 'update' || name === 'insert') {
      type = 'query'
      layer = 'database'
      detectedLibrary = 'orm/sql'
    }
    else if (name === 'get' || name === 'set' || name === 'hget' || name === 'hset') {
      type = 'cache'
      layer = 'cache'
      detectedLibrary = 'redis/cache'
    }
    else if (name === 'fetch' || name === 'axios' || name === 'request') {
      type = 'network'
      layer = 'network'
      detectedLibrary = 'http/fetch'
    }

    if (type && layer) {
      const id = `${sourceFile.fileName}:${line}-${name}`
      const estimated_frequency = inLoop ? 100 : 1

      let estimated_latency = 10
      if (layer === 'cache') estimated_latency = 5
      if (layer === 'database') estimated_latency = 50
      if (layer === 'network') estimated_latency = 200

      const site: AccessSite = {
        id,
        file: sourceFile.fileName,
        line,
        type,
        layer,
        estimated_frequency,
        measured_frequency: null,
        estimated_latency,
        measured_latency: null,
      }

      if (detectedLibrary) {
        site.detected_library = detectedLibrary
      }

      return site
    }

    return null
  }
}
