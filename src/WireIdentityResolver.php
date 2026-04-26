<?php

namespace SoureCode\Wire;

use Doctrine\Persistence\ManagerRegistry;
use SoureCode\Wire\Attribute\Wire;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Routing\RouterInterface;

/**
 * Builds the `__class` / `__id` / `__submit` identity tag for a value.
 * Used both by the path-walking runtime and by WireIdentityNormalizer.
 */
class WireIdentityResolver
{
    public function __construct(
        private readonly ManagerRegistry $registry,
        private readonly RouterInterface $router,
        private readonly bool $debug,
    ) {
    }

    /**
     * @return array{__class:string,__id:mixed,__submit?:array{url:string,method:string}}|null
     */
    public function tag(object $value): ?array
    {
        $class   = $value::class;
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

        $submit = $this->resolveSubmit($class, $idValues);
        if ($submit !== null) {
            $tag['__submit'] = $submit;
        }

        return $tag;
    }

    /**
     * @param array<string,mixed> $idValues
     * @return array{url:string,method:string}|null
     */
    private function resolveSubmit(string $class, array $idValues): ?array
    {
        $reflection = new \ReflectionClass($class);
        $attrs      = $reflection->getAttributes(Wire::class);
        if ($attrs === []) {
            return null;
        }

        $wire = $attrs[0]->newInstance();
        if ($wire->submit === null) {
            return null;
        }

        $route = $this->router->getRouteCollection()->get($wire->submit);
        if ($route === null) {
            throw new \RuntimeException(sprintf(
                'Wire route "%s" referenced by %s does not exist.',
                $wire->submit,
                $class
            ));
        }

        $methods = $route->getMethods();

        return [
            'url'    => $this->router->generate($wire->submit, $idValues, UrlGeneratorInterface::ABSOLUTE_PATH),
            'method' => $methods === [] ? 'POST' : $methods[0],
        ];
    }
}
