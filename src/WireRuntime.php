<?php

namespace SoureCode\Wire;

use Symfony\Component\PropertyAccess\PropertyAccess;
use Symfony\Component\PropertyAccess\PropertyAccessorInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
use Symfony\Contracts\Service\ResetInterface;
use Twig\Extension\RuntimeExtensionInterface;

class WireRuntime implements RuntimeExtensionInterface, ResetInterface
{
    /** @var array<int,string> spl_object_id → "scope#path" */
    private array $globalSeen = [];

    private readonly PropertyAccessorInterface $accessor;

    public function __construct(
        private readonly WireIdentityResolver $identity,
        private readonly NormalizerInterface $serializer,
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
     * @param string[]            $groups  optional Symfony Serializer groups for additive expansion
     */
    public function renderScope(array $context, array $paths, string $scopeId, array $groups = []): string
    {
        $data = $this->buildScopeData($context, $paths, $scopeId);

        if ($groups !== []) {
            $this->augmentWithGroups($data, $context, $groups);
        }

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
     * For each top-level scope variable that resolves to an object in the
     * Twig context, normalize that object with the configured groups and
     * fill any keys not already present in the path-walked payload.
     *
     * @param array<string,mixed> $data
     * @param array<string,mixed> $context
     * @param string[]            $groups
     */
    private function augmentWithGroups(array &$data, array $context, array $groups): void
    {
        foreach ($data as $rootName => $rootValue) {
            if (!is_array($rootValue) || isset($rootValue['$ref'])) {
                continue;
            }

            $object = $context[$rootName] ?? null;
            if (!is_object($object) || $object instanceof \stdClass) {
                continue;
            }

            $additional = $this->serializer->normalize($object, null, ['groups' => $groups]);
            if (!is_array($additional)) {
                continue;
            }

            foreach ($additional as $k => $v) {
                if (!array_key_exists($k, $data[$rootName])) {
                    $data[$rootName][$k] = $v;
                }
            }
        }
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

                if (isset($localSeen[$oid]) && $localSeen[$oid] !== $currentPath) {
                    $resultRef[$key] = ['$ref' => $localSeen[$oid]];
                    return;
                }
                if (isset($this->globalSeen[$oid]) && $this->globalSeen[$oid] !== $scopeId . '#' . $currentPath) {
                    $resultRef[$key] = ['$ref' => $this->globalSeen[$oid]];
                    return;
                }

                if (!isset($localSeen[$oid])) {
                    $localSeen[$oid]        = $currentPath;
                    $this->globalSeen[$oid] = $scopeId . '#' . $currentPath;
                }

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
                return;
            }

            $current   = $value;
            $resultRef = &$resultRef[$key];
        }
    }

    /**
     * @param array<int,string> $localSeen in/out
     * @return array<string,mixed>
     */
    private function wrapObject(object $value, string $currentPath, string $scopeId, array &$localSeen): array
    {
        $oid = spl_object_id($value);

        if (isset($localSeen[$oid]) && $localSeen[$oid] !== $currentPath) {
            return ['$ref' => $localSeen[$oid]];
        }
        if (isset($this->globalSeen[$oid]) && $this->globalSeen[$oid] !== $scopeId . '#' . $currentPath) {
            return ['$ref' => $this->globalSeen[$oid]];
        }

        if (!isset($localSeen[$oid])) {
            $localSeen[$oid]        = $currentPath;
            $this->globalSeen[$oid] = $scopeId . '#' . $currentPath;
        }

        $tag = $this->identity->tag($value);
        return $tag ?? [];
    }

    private function fetch(mixed $current, string $key): mixed
    {
        if (is_array($current)) {
            return array_key_exists($key, $current) ? $current[$key] : null;
        }

        if ($current instanceof \stdClass) {
            return property_exists($current, $key) ? $current->$key : null;
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
