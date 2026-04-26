<?php

namespace SoureCode\Wire;

use Symfony\Component\PropertyAccess\PropertyAccess;
use Symfony\Component\PropertyAccess\PropertyAccessorInterface;
use Symfony\Contracts\Service\ResetInterface;
use Twig\Extension\RuntimeExtensionInterface;

class WireRuntime implements RuntimeExtensionInterface, ResetInterface
{
    /** @var array<int,string> spl_object_id → "scope#path" */
    private array $globalSeen = [];

    private readonly PropertyAccessorInterface $accessor;

    public function __construct(
        private readonly WireIdentityResolver $identity,
    ) {
        $this->accessor = PropertyAccess::createPropertyAccessor();
    }

    public function reset(): void
    {
        $this->globalSeen = [];
        WireNodeVisitor::resetCascade();
    }

    /**
     * @param array<string,mixed> $context full Twig $context
     * @param string[]            $paths   bound dot-paths collected by the visitor
     */
    public function renderScope(array $context, array $paths, string $scopeId): string
    {
        $data = $this->buildScopeData($context, $paths, $scopeId);
        if ($data === []) {
            return '';
        }

        return '<!-- wire-scope:' . $scopeId . ' -->'
            . '<script type="wire">' . json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>';
    }

    /**
     * @param array<string,mixed> $context
     * @param string[]            $paths
     * @return array<string,mixed>
     */
    private function buildScopeData(array $context, array $paths, string $scopeId): array
    {
        $result    = [];
        $localSeen = [];

        foreach ($paths as $path) {
            $this->insertPath($result, $localSeen, $context, $path, $scopeId);
        }

        return $result;
    }

    /**
     * Walk a single dot-path against `$context`, inserting the leaf value
     * into `$result` at the same nested location. Intermediate objects are
     * tagged with their identity (when Doctrine-managed) and de-duplicated
     * via spl_object_id within the scope and across scopes (`$ref`).
     *
     * @param array<string,mixed> $result    in/out
     * @param array<int,string>   $localSeen in/out, oid → path within this scope
     * @param array<string,mixed> $context
     */
    private function insertPath(array &$result, array &$localSeen, array $context, string $path, string $scopeId): void
    {
        $segments    = explode('.', $path);
        $current     = $context;
        $currentPath = '';
        $resultRef   = &$result;

        while ($segments !== []) {
            $key         = array_shift($segments);
            $currentPath = $currentPath === '' ? $key : $currentPath . '.' . $key;
            $value       = $this->fetch($current, $key);

            if ($segments === []) {
                if (is_object($value)) {
                    $resultRef[$key] = $this->wrapObject($value, $currentPath, $scopeId, $localSeen);
                } else {
                    $resultRef[$key] = $value;
                }
                return;
            }

            if ($value === null) {
                return;
            }

            if (is_object($value)) {
                $oid = spl_object_id($value);

                if (isset($localSeen[$oid])) {
                    $resultRef[$key] = ['$ref' => $localSeen[$oid]];
                    return;
                }
                if (isset($this->globalSeen[$oid])) {
                    $resultRef[$key] = ['$ref' => $this->globalSeen[$oid]];
                    return;
                }

                $localSeen[$oid]        = $currentPath;
                $this->globalSeen[$oid] = $scopeId . '#' . $currentPath;

                if (!isset($resultRef[$key]) || !is_array($resultRef[$key])) {
                    $resultRef[$key] = [];
                }

                $tag = $this->identity->tag($value);
                if ($tag !== null) {
                    foreach ($tag as $k => $v) {
                        if (!array_key_exists($k, $resultRef[$key])) {
                            $resultRef[$key][$k] = $v;
                        }
                    }
                }
            } elseif (is_array($value)) {
                if (!isset($resultRef[$key]) || !is_array($resultRef[$key])) {
                    $resultRef[$key] = [];
                }
            } else {
                // Scalar at non-leaf position — bound paths reach into it
                // make no sense; leave previous slot alone.
                return;
            }

            $current   = $value;
            $resultRef = &$resultRef[$key];
        }
    }

    /**
     * Tag a leaf object value with its identity (when applicable) and check
     * for $ref dedup. Returns either an array (with __class/__id/...) or a
     * `$ref` placeholder.
     *
     * @param array<int,string> $localSeen in/out
     * @return array<string,mixed>
     */
    private function wrapObject(object $value, string $currentPath, string $scopeId, array &$localSeen): array
    {
        $oid = spl_object_id($value);

        if (isset($localSeen[$oid])) {
            return ['$ref' => $localSeen[$oid]];
        }
        if (isset($this->globalSeen[$oid])) {
            return ['$ref' => $this->globalSeen[$oid]];
        }

        $localSeen[$oid]        = $currentPath;
        $this->globalSeen[$oid] = $scopeId . '#' . $currentPath;

        $tag = $this->identity->tag($value);
        return $tag ?? [];
    }

    /**
     * Read `$key` out of `$current`. Arrays use index lookup; objects
     * fall through to PropertyAccessor (covers public properties + getters).
     */
    private function fetch(mixed $current, string $key): mixed
    {
        if (is_array($current)) {
            return array_key_exists($key, $current) ? $current[$key] : null;
        }

        if (is_object($current)) {
            try {
                return $this->accessor->getValue($current, $key);
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }
}
