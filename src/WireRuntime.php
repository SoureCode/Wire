<?php

namespace SoureCode\Wire;

use Doctrine\Persistence\ManagerRegistry;
use SoureCode\Wire\Attribute\Wire;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Serializer\SerializerInterface;
use Twig\Extension\RuntimeExtensionInterface;

class WireRuntime implements RuntimeExtensionInterface
{
    /** @var array<int, string> spl_object_id → "scope#path" */
    private array $globalSeen = [];

    public function __construct(
        private readonly SerializerInterface $serializer,
        private readonly ManagerRegistry $registry,
        private readonly UrlGeneratorInterface $router,
        private readonly bool $debug,
        private readonly string $serializerGroup = 'wire',
    ) {
    }

    public function reset(): void
    {
        $this->globalSeen = [];
    }

    /**
     * @param array<string, mixed> $context full Twig $context
     * @param string[]             $rootNames variable names to serialize
     */
    public function renderScope(array $context, array $rootNames, string $scopeId): string
    {
        $data = $this->buildScopeData($context, $rootNames, $scopeId);

        if ($data === []) {
            return '';
        }

        return '<!-- wire-scope:' . $scopeId . ' -->'
            . '<script type="wire">' . json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>';
    }

    public function renderScopeEnd(string $scopeId, bool $emitted): string
    {
        return $emitted ? '<!-- /wire-scope:' . $scopeId . ' -->' : '';
    }

    /**
     * @param array<string, mixed> $context
     * @param string[]             $rootNames
     * @return array<string, mixed>
     */
    private function buildScopeData(array $context, array $rootNames, string $scopeId): array
    {
        $localSeen = [];
        $result = [];

        foreach ($rootNames as $name) {
            if (!array_key_exists($name, $context)) {
                continue;
            }

            $value = $context[$name];

            if ($value === null) {
                continue;
            }

            $result[$name] = $this->serializeValue($value, $scopeId, $name, $localSeen);
        }

        return $result;
    }

    private function serializeValue(mixed $value, string $scopeId, string $path, array &$localSeen): mixed
    {
        if (is_object($value)) {
            $oid = spl_object_id($value);

            if (isset($localSeen[$oid])) {
                return ['$ref' => $localSeen[$oid]];
            }

            if (isset($this->globalSeen[$oid])) {
                return ['$ref' => $this->globalSeen[$oid]];
            }

            $localSeen[$oid] = $path;
            $this->globalSeen[$oid] = $scopeId . '#' . $path;

            return $this->serializeObject($value);
        }

        if (is_array($value)) {
            $out = [];
            foreach ($value as $key => $item) {
                $out[$key] = $this->serializeValue($item, $scopeId, $path . '.' . $key, $localSeen);
            }
            return $out;
        }

        return $value;
    }

    private function serializeObject(object $value): array
    {
        if ($value instanceof \stdClass) {
            $payload = get_object_vars($value);
        } else {
            $payload = $this->serializer->normalize($value, null, [
                'groups' => [$this->serializerGroup],
            ]);

            if (!is_array($payload)) {
                $payload = [];
            }
        }

        $identity = $this->identity($value);

        if ($identity !== null) {
            return $identity + $payload;
        }

        return $payload;
    }

    /**
     * @return array{__class: string, __id: mixed, __submit?: string}|null
     */
    private function identity(object $value): ?array
    {
        $class = $value::class;
        $manager = $this->registry->getManagerForClass($class);

        if ($manager === null) {
            return null;
        }

        $metadata = $manager->getClassMetadata($class);
        $idValues = $metadata->getIdentifierValues($value);

        if ($idValues === [] || in_array(null, $idValues, true)) {
            return null;
        }

        $id = count($idValues) === 1 ? reset($idValues) : $idValues;

        $tag = [
            '__class' => $this->debug ? $class : substr(hash('sha256', $class), 0, 8),
            '__id'    => $id,
        ];

        $submit = $this->resolveSubmit($class);
        if ($submit !== null) {
            $tag['__submit'] = $submit;
        }

        return $tag;
    }

    private function resolveSubmit(string $class): ?string
    {
        $reflection = new \ReflectionClass($class);
        $attrs = $reflection->getAttributes(Wire::class);

        if ($attrs === []) {
            return null;
        }

        $wire = $attrs[0]->newInstance();

        if ($wire->submit === null) {
            return null;
        }

        return $this->router->generate($wire->submit, [], UrlGeneratorInterface::ABSOLUTE_PATH);
    }
}
