const Wire = (() => {
    const scopes = []

    function resolvePath(obj, path) {
        if (!path) return obj
        return path.split('.').reduce((o, k) => {
            if (o === null || o === undefined) return undefined
            return typeof o === 'object' ? o[k] : undefined
        }, obj)
    }

    function applyBinding(el, target, value) {
        if (target === 'text') el.textContent = value ?? ''
        else if (target === 'value') el.value = value ?? ''
        else el.setAttribute(target, value ?? '')
    }

    function resolveRefs(data, root = data) {
        for (const key of Object.keys(data)) {
            const value = data[key]
            if (value && typeof value === 'object') {
                if ('$ref' in value) {
                    const ref = value['$ref']
                    if (ref.includes('#')) {
                        const [scopeName, path] = ref.split('#')
                        const refScope = scopes.find(s => s.name === scopeName)
                        if (refScope) data[key] = resolvePath(refScope.data, path)
                    } else {
                        data[key] = resolvePath(root, ref)
                    }
                } else {
                    resolveRefs(value, root)
                }
            }
        }
        return data
    }

    function buildRefMap(data) {
        const seen = new Map()
        const refMap = {}

        function walk(obj, path) {
            if (!obj || typeof obj !== 'object') return
            if (seen.has(obj)) {
                const original = seen.get(obj)
                if (!refMap[original]) refMap[original] = []
                if (!refMap[path]) refMap[path] = []
                refMap[original].push({ scope: null, path })
                refMap[path].push({ scope: null, path: original })
                return
            }
            seen.set(obj, path)
            for (const key of Object.keys(obj)) {
                walk(obj[key], path ? `${path}.${key}` : key)
            }
        }

        walk(data, '')
        return refMap
    }

    function buildCrossScopeRefs() {
        const objectToEntries = new WeakMap()

        for (const scope of scopes) {
            function register(obj, path) {
                if (!obj || typeof obj !== 'object') return
                if (!objectToEntries.has(obj)) objectToEntries.set(obj, [])
                objectToEntries.get(obj).push({ scope, path })
                for (const key of Object.keys(obj)) {
                    register(obj[key], path ? `${path}.${key}` : key)
                }
            }
            register(scope.data, '')
        }

        for (const scope of scopes) {
            function addAliases(obj, path) {
                if (!obj || typeof obj !== 'object') return
                const entries = objectToEntries.get(obj) || []
                for (const { scope: otherScope, path: otherPath } of entries) {
                    if (otherScope === scope) continue
                    if (!scope.refMap[path]) scope.refMap[path] = []
                    scope.refMap[path].push({ scope: otherScope, path: otherPath })
                }
                for (const key of Object.keys(obj)) {
                    addAliases(obj[key], path ? `${path}.${key}` : key)
                }
            }
            addAliases(scope.data, '')
        }
    }

    function makeProxy(data, scope, path = '') {
        return new Proxy(data, {
            get(target, key) {
                const val = target[key]
                if (val !== null && typeof val === 'object') {
                    return makeProxy(val, scope, path ? `${path}.${key}` : key)
                }
                return val
            },
            set(target, key, value) {
                target[key] = value
                const fullPath = path ? `${path}.${key}` : key
                updateBindings(scope, fullPath)
                return true
            }
        })
    }

    function updateScopeBindings(scope, changedPath) {
        for (const binding of scope.bindings) {
            if (binding.path === changedPath || binding.path.startsWith(changedPath + '.')) {
                applyBinding(binding.el, binding.target, resolvePath(scope.data, binding.path))
            }
        }
    }

    function updateBindings(scope, changedPath) {
        updateScopeBindings(scope, changedPath)

        for (const [refPath, aliases] of Object.entries(scope.refMap)) {
            if (changedPath === refPath || changedPath.startsWith(refPath + '.')) {
                const suffix = changedPath.slice(refPath.length)
                for (const alias of aliases) {
                    const aliasedPath = alias.path + suffix
                    const targetScope = alias.scope || scope
                    updateScopeBindings(targetScope, aliasedPath)
                }
            }
        }
    }

    function parseScopes() {
        const walker = document.createTreeWalker(
            document,
            NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT
        )

        const stack = []
        let node

        while ((node = walker.nextNode())) {
            if (node.nodeType === Node.COMMENT_NODE) {
                const text = node.textContent.trim()
                if (text.startsWith('wire-scope:')) {
                    stack.push({ name: text.slice('wire-scope:'.length), data: null, bindings: [], refMap: {}, startComment: node, endComment: null })
                } else if (text.startsWith('/wire-scope:') && stack.length) {
                    const scope = stack.pop()
                    scope.endComment = node
                    if (scope.data) {
                        scopes.push(scope)
                    }
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && stack.length) {
                const scope = stack[stack.length - 1]

                if (node.tagName === 'SCRIPT' && node.type === 'wire') {
                    scope.data = JSON.parse(node.textContent)
                }

                if (node.hasAttribute('data-wire')) {
                    const [path, target = 'text'] = node.getAttribute('data-wire').split(':')
                    scope.bindings.push({ el: node, path, target })
                }
            }
        }

        for (const scope of scopes) {
            resolveRefs(scope.data)
            scope.refMap = buildRefMap(scope.data)
        }

        buildCrossScopeRefs()

        for (const scope of scopes) {
            scope.proxy = makeProxy(scope.data, scope)
            setupTwoWay(scope)
        }
    }

    function setupTwoWay(scope) {
        for (const binding of scope.bindings) {
            if (binding.target === 'value') {
                binding.el.addEventListener('input', () => {
                    const parts = binding.path.split('.')
                    const last = parts.pop()
                    const parent = parts.reduce((o, k) => o[k], scope.proxy)
                    parent[last] = binding.el.value
                })
            }
        }
    }

    function findScopeFor(el) {
        for (const scope of scopes) {
            const afterStart = scope.startComment.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
            const beforeEnd = scope.endComment.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING
            if (afterStart && beforeEnd) return scope
        }
        return null
    }

    function registerElement(el) {
        if (!el.hasAttribute('data-wire')) return
        const scope = findScopeFor(el)
        if (!scope) return
        if (scope.bindings.some(b => b.el === el)) return
        const [path, target = 'text'] = el.getAttribute('data-wire').split(':')
        scope.bindings.push({ el, path, target })
        if (target === 'value') {
            el.addEventListener('input', () => {
                const parts = path.split('.')
                const last = parts.pop()
                const parent = parts.reduce((o, k) => o[k], scope.proxy)
                parent[last] = el.value
            })
        }
    }

    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.hasAttribute('data-wire')) registerElement(node)
                        node.querySelectorAll('[data-wire]').forEach(registerElement)
                    }
                }
            }
        })
        observer.observe(document.documentElement, { childList: true, subtree: true })
    }

    function init() {
        parseScopes()
        setupMutationObserver()
    }

    function get(name, index = 0) {
        return scopes.filter(s => s.name === name)[index]?.proxy
    }

    function getAll(name) {
        return scopes.filter(s => s.name === name).map(s => s.proxy)
    }

    function deepClone(obj, seen = new WeakSet()) {
        if (!obj || typeof obj !== 'object') return obj
        if (seen.has(obj)) return null
        seen.add(obj)
        if (Array.isArray(obj)) return obj.map(item => deepClone(item, seen))
        const result = {}
        for (const key of Object.keys(obj)) result[key] = deepClone(obj[key], seen)
        return result
    }

    function snapshot(name) {
        if (name === undefined) {
            return scopes.map(s => ({ scope: s.name, data: deepClone(s.data) }))
        }
        const scope = scopes.find(s => s.name === name)
        if (!scope) return null
        return deepClone(scope.data)
    }

    return { init, scopes, get, getAll, snapshot }
})()

document.addEventListener('DOMContentLoaded', () => Wire.init())
