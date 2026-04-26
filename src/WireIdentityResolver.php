<?php

namespace SoureCode\Wire;

use Doctrine\Persistence\ManagerRegistry;
use SoureCode\Wire\Attribute\Wire;
use Symfony\Component\PropertyAccess\Exception\AccessException;
use Symfony\Component\PropertyAccess\Exception\UnexpectedTypeException;
use Symfony\Component\PropertyAccess\PropertyAccessorInterface;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Routing\RouterInterface;

/**
 * Builds the identity tag (`__class`, `__id`, optional `__read` / `__update`)
 * for a value. Used both by the path-walking runtime and by WireIdentityNormalizer.
 */
class WireIdentityResolver
{
    public function __construct(
        private readonly ManagerRegistry $registry,
        private readonly RouterInterface $router,
        private readonly PropertyAccessorInterface $propertyAccessor,
        private readonly bool $debug,
    ) {
    }

    /**
     * @return array{__class:string,__id:mixed,__read?:array{url:string,method:string},__update?:array{url:string,method:string}}|null
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

        $wire = $this->wireAttribute($class);
        if ($wire === null) {
            return $tag;
        }

        $read = $this->resolveRoute($class, $value, $wire->readRouteName, $wire->readRouteParams);
        if ($read !== null) {
            $tag['__read'] = $read;
        }

        $update = $this->resolveRoute($class, $value, $wire->updateRouteName, $wire->updateRouteParams);
        if ($update !== null) {
            $tag['__update'] = $update;
        }

        return $tag;
    }

    private function wireAttribute(string $class): ?Wire
    {
        $reflection = new \ReflectionClass($class);
        $attrs      = $reflection->getAttributes(Wire::class);
        if ($attrs === []) {
            return null;
        }

        return $attrs[0]->newInstance();
    }

    /**
     * @param array<string,mixed> $hardcodedParams
     * @return array{url:string,method:string}|null
     */
    private function resolveRoute(string $class, object $value, ?string $routeName, array $hardcodedParams): ?array
    {
        if ($routeName === null) {
            return null;
        }

        $route = $this->router->getRouteCollection()->get($routeName);
        if ($route === null) {
            throw new \RuntimeException(sprintf(
                'Wire route "%s" referenced by %s does not exist.',
                $routeName,
                $class
            ));
        }

        $variables = $route->compile()->getVariables();
        $params    = $hardcodedParams;

        foreach ($variables as $variable) {
            if (array_key_exists($variable, $params)) {
                continue;
            }

            try {
                $params[$variable] = $this->propertyAccessor->getValue($value, $variable);
            } catch (AccessException | UnexpectedTypeException $exception) {
                throw new \RuntimeException(sprintf(
                    'Wire cannot resolve route parameter "%s" for %s on route "%s": %s',
                    $variable,
                    $class,
                    $routeName,
                    $exception->getMessage()
                ), 0, $exception);
            }
        }

        $methods = $route->getMethods();

        return [
            'url'    => $this->router->generate($routeName, $params, UrlGeneratorInterface::ABSOLUTE_PATH),
            'method' => $methods === [] ? 'GET' : $methods[0],
        ];
    }
}
