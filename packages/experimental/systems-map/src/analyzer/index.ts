import * as ts from 'typescript'
import { AccessSite, AccessSiteType, Layer } from '../models/index.js'

export interface AnalysisResult {
  accessSites: AccessSite[]
  coveragePct: number
}

// Internal representation for the call graph
interface FunctionDef {
  name: string
  file: string
  accessSites: AccessSite[]
  calls: string[] // Names of functions this function calls
}

export class StaticAnalyzer {
  private accessSites: AccessSite[] = []
  private analyzedNodes = 0
  private totalNodes = 0

  private functionRegistry = new Map<string, FunctionDef>()

  public analyzeFile(filePath: string, fileContent: string): void {
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true,
    )

    this.visitNode(sourceFile, sourceFile, 0, null)
  }

  public getResult(): AnalysisResult {
    // Phase 2 of AST traversal: Propagate access sites up the call graph to reveal hidden N+1s
    this.propagateCallGraph()

    const coveragePct = this.totalNodes === 0 ? 100 : Math.round((this.analyzedNodes / this.totalNodes) * 100)
    return {
      accessSites: this.accessSites,
      coveragePct,
    }
  }

  private isHigherOrderLoop(node: ts.CallExpression): boolean {
    if (ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name.text
      if (name === 'map' || name === 'forEach' || name === 'filter' || name === 'reduce') {
        return true
      }
    }
    return false
  }

  private getFunctionName(node: ts.Node): string | null {
    if (ts.isFunctionDeclaration(node) && node.name) {
      return node.name.text
    }
    if (
      (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
       (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) ||
      (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name))
    ) {
      return node.name.text
    }
    return null
  }

  private visitNode(node: ts.Node, sourceFile: ts.SourceFile, loopDepth: number, currentFunction: string | null): void {
    this.totalNodes++

    let nextFunction = currentFunction
    const possibleFuncName = this.getFunctionName(node)
    if (possibleFuncName) {
      nextFunction = possibleFuncName
      if (!this.functionRegistry.has(nextFunction)) {
        this.functionRegistry.set(nextFunction, {
          name: nextFunction,
          file: sourceFile.fileName,
          accessSites: [],
          calls: [],
        })
      }
    }

    let currentLoopDepth = loopDepth

    // Check if we are entering a loop
    const isStandardLoop =
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)

    let isHOF = false
    let isReduce = false
    if (ts.isCallExpression(node)) {
      isHOF = this.isHigherOrderLoop(node)
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'reduce') {
        isReduce = true
      }
    }

    if (isStandardLoop || isHOF) {
      currentLoopDepth += 1
    }

    if (ts.isCallExpression(node)) {
      const expression = node.expression
      let name = ''

      if (ts.isPropertyAccessExpression(expression)) {
        name = expression.name.text
      } else if (ts.isIdentifier(expression)) {
        name = expression.text
      }

      // Track the function call for cross-file traversal
      if (nextFunction && name) {
        const def = this.functionRegistry.get(nextFunction)
        if (def) def.calls.push(name)
      }

      const site = this.analyzeCallExpression(node, sourceFile, currentLoopDepth, nextFunction)
      if (site) {
        this.accessSites.push(site)
        if (nextFunction) {
          this.functionRegistry.get(nextFunction)?.accessSites.push(site)
        }
      } else if (isReduce && currentLoopDepth > 1) {
        // Track deep compute loops (Memory vs Compute tradeoff)
        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart())
        const computeSite: AccessSite = {
          id: `${sourceFile.fileName}:${lineAndChar.line + 1}-reduce`,
          file: sourceFile.fileName,
          line: lineAndChar.line + 1,
          type: 'compute',
          layer: 'in-memory',
          estimated_frequency: Math.pow(10, currentLoopDepth),
          measured_frequency: null,
          estimated_latency: 0,
          measured_latency: null,
          loop_depth: currentLoopDepth,
          parent_function: nextFunction ? nextFunction : '',
          code_snippet: this.extractSnippet(sourceFile, node),
        }
        this.accessSites.push(computeSite)
      }
    }

    if (!ts.isIdentifier(node) && !ts.isStringLiteral(node)) {
      this.analyzedNodes++
    } else {
      this.totalNodes--
    }

    ts.forEachChild(node, child => this.visitNode(child, sourceFile, currentLoopDepth, nextFunction))
  }

  private propagateCallGraph(): void {
    // A simplistic traversal: If function A calls function B, and function B has a DB query,
    // and function A was called inside a loop, that's a hidden N+1.
    // For MVP, we will artificially inflate the `estimated_frequency` of the nested access sites
    // based on the max loop depth of their callers.
    for (const [funcName, def] of this.functionRegistry.entries()) {
      for (const calledName of def.calls) {
        const calledDef = this.functionRegistry.get(calledName)
        if (calledDef) {
          // We found a cross-link
          const callerLoops = def.accessSites.map(s => s.loop_depth).reduce((a, b) => Math.max(a, b), 0)
          if (callerLoops > 0) {
            for (const site of calledDef.accessSites) {
              // Inherit the loop penalty from the caller
              if (site.loop_depth < callerLoops) {
                site.loop_depth = callerLoops
                site.estimated_frequency = Math.pow(10, callerLoops)
                // Optionally tag it to indicate it was inherited via cross-file traversal
                if (!site.called_functions) site.called_functions = []
                site.called_functions.push(`Inherited loop penalty from ${funcName}`)
              }
            }
          }
        }
      }
    }
  }

  private extractSnippet(sourceFile: ts.SourceFile, node: ts.Node): string {
    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line
    const lines = sourceFile.text.split('\n')

    // Extract 3 lines before and 3 lines after
    const start = Math.max(0, startLine - 3)
    const end = Math.min(lines.length - 1, startLine + 3)

    return lines.slice(start, end + 1).join('\n')
  }

  private analyzeCallExpression(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    loopDepth: number,
    parentFunc: string | null,
  ): AccessSite | null {
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
      const estimated_frequency = loopDepth > 0 ? Math.pow(10, loopDepth) : 1

      let estimated_latency = 10
      if (layer === 'cache') estimated_latency = 5
      if (layer === 'database') estimated_latency = 50
      if (layer === 'network') estimated_latency = 200

      const snippet = this.extractSnippet(sourceFile, node)

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
        loop_depth: loopDepth,
        code_snippet: snippet,
        parent_function: parentFunc ? parentFunc : '',
        called_functions: [name],
      }

      if (detectedLibrary) {
        site.detected_library = detectedLibrary
      }

      return site
    }

    return null
  }
}
