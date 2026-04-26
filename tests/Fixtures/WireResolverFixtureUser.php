<?php

namespace SoureCode\Wire\Tests\Fixtures;

use SoureCode\Wire\Attribute\Wire;

#[Wire(
    readRouteName:   'fixture_user_read',
    updateRouteName: 'fixture_user_update',
)]
class WireResolverFixtureUser
{
    public function __construct(
        public int $id,
        public string $name,
    ) {
    }
}
