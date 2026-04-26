<?php

namespace SoureCode\Wire\Serializer;

use Doctrine\Persistence\ManagerRegistry;
use SoureCode\Wire\Attribute\Wire;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

/**
 * Tags Doctrine-managed objects with __class / __id / __submit identity
 * during serialization. Wraps any inner ObjectNormalizer.
 */
class WireIdentityNormalizer implements NormalizerInterface, NormalizerAwareInterface
{
    use NormalizerAwareTrait;

    /** @var array<int, true> spl_object_id of objects currently being normalized */
    private array $inProgress = [];

    public function __construct(
        private readonly ManagerRegistry $registry,
        private readonly UrlGeneratorInterface $router,
        private readonly bool $debug,
    ) {
    }

    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        if (!is_object($data) || $data instanceof \stdClass) {
            return false;
        }

        if (isset($this->inProgress[spl_object_id($data)])) {
            return false;
        }

        return $this->identity($data) !== null;
    }

    public function normalize(mixed $object, ?string $format = null, array $context = []): array
    {
        $oid = spl_object_id($object);
        $this->inProgress[$oid] = true;

        try {
            $payload = $this->normalizer->normalize($object, $format, $context);
        } finally {
            unset($this->inProgress[$oid]);
        }

        if (!is_array($payload)) {
            $payload = [];
        }

        return $this->identity($object) + $payload;
    }

    public function getSupportedTypes(?string $format): array
    {
        return ['object' => false];
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
