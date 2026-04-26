<?php

namespace Wire;

class WireHelper
{
    private static array $globalSeen = [];

    public static function reset(): void
    {
        self::$globalSeen = [];
        WireNodeVisitor::resetCascade();
    }

    public static function extract(array $context, array $paths, string $scope): array
    {
        $localSeen = [];
        $result = [];

        foreach ($paths as $path) {
            $parts = explode('.', $path);
            self::setByPath($result, $parts, $context, $localSeen, [], $scope);
        }

        return $result;
    }

    private static function setByPath(array &$result, array $parts, mixed $context, array &$localSeen, array $currentPath, string $scope): void
    {
        $key = array_shift($parts);

        if (is_array($context)) {
            if (!array_key_exists($key, $context)) return;
            $value = $context[$key];
        } elseif (is_object($context)) {
            if (!property_exists($context, $key)) return;
            $value = $context->$key;
        } else {
            return;
        }

        $currentPath[] = $key;
        $dotPath = implode('.', $currentPath);

        if (empty($parts)) {
            $result[$key] = $value;
            return;
        }

        if (is_object($value)) {
            $id = spl_object_id($value);

            if (isset($localSeen[$id])) {
                if ($localSeen[$id] !== $dotPath) {
                    $result[$key] = ['$ref' => $localSeen[$id]];
                    return;
                }
            } elseif (isset(self::$globalSeen[$id])) {
                if (self::$globalSeen[$id] !== $scope . '#' . $dotPath) {
                    $result[$key] = ['$ref' => self::$globalSeen[$id]];
                    return;
                }
            } else {
                $localSeen[$id] = $dotPath;
                self::$globalSeen[$id] = $scope . '#' . $dotPath;
            }
        }

        if (!isset($result[$key]) || !is_array($result[$key]) || isset($result[$key]['$ref'])) {
            if (isset($result[$key]['$ref'])) return;
            $result[$key] = [];
        }

        self::setByPath($result[$key], $parts, $value, $localSeen, $currentPath, $scope);
    }
}
