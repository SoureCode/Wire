<?php

namespace SoureCode\Wire\Serializer;

use SoureCode\Wire\WireIdentityResolver;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

class WireIdentityNormalizer implements NormalizerInterface, NormalizerAwareInterface
{
    use NormalizerAwareTrait;

    /** @var array<int,true> spl_object_id of objects currently being normalized */
    private array $inProgress = [];

    public function __construct(
        private readonly WireIdentityResolver $identity,
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
        return $this->identity->tag($data) !== null;
    }

    public function normalize(mixed $object, ?string $format = null, array $context = []): array
    {
        $oid                    = spl_object_id($object);
        $this->inProgress[$oid] = true;

        try {
            $payload = $this->normalizer->normalize($object, $format, $context);
        } finally {
            unset($this->inProgress[$oid]);
        }

        if (!is_array($payload)) {
            $payload = [];
        }

        return $this->identity->tag($object) + $payload;
    }

    public function getSupportedTypes(?string $format): array
    {
        return ['object' => false];
    }
}
