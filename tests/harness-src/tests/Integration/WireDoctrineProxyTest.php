<?php

namespace App\Tests\Integration;

use App\Entity\User;
use App\Entity\Address;
use SoureCode\Wire\WireHelper;

class WireDoctrineProxyTest extends WireIntegrationTestCase
{
    public function testGhostProxyIsInitializedAndExtracted(): void
    {
        $user = new User('Proxy User', 'proxy@example.com');
        $this->em->persist($user);
        $this->em->flush();
        $id = $user->id;

        $this->em->clear();
        $proxy = $this->em->getReference(User::class, $id);

        $data = $this->wireData('wire_test/user.html.twig', ['user' => $proxy]);
        $this->assertSame('Proxy User', $data['user']['name']);
        $this->assertSame('proxy@example.com', $data['user']['email']);
    }

    public function testGhostProxyPreservesIdentityAcrossScopes(): void
    {
        $user = new User('Ghost', 'ghost@example.com');
        $this->em->persist($user);
        $this->em->flush();
        $id = $user->id;

        $this->em->clear();
        $proxy = $this->em->getReference(User::class, $id);

        WireHelper::reset();
        WireHelper::extract(['user' => $proxy], ['user.name', 'user.email'], 'scope1');
        $result = WireHelper::extract(['owner' => $proxy], ['owner.name'], 'scope2');

        $this->assertArrayHasKey('$ref', $result['owner']);
        $this->assertStringStartsWith('scope1#', $result['owner']['$ref']);
    }

    public function testLazyManyToOneProxyIsInitializedByWire(): void
    {
        $address = new Address('Main St', 'Munich', '80333');
        $user    = new User('Lazy', 'lazy@example.com');
        $user->address = $address;

        $this->em->persist($address);
        $this->em->persist($user);
        $this->em->flush();
        $userId = $user->id;

        $this->em->clear();
        $proxy = $this->em->find(User::class, $userId);

        $data = $this->wireData('wire_test/user_relations.html.twig', ['user' => $proxy]);
        $this->assertSame('Munich', $data['user']['address']['city']);
        $this->assertSame('Main St', $data['user']['address']['street']);
    }

    public function testDoctrineIdentityMapReturnsSameProxyObject(): void
    {
        $address = new Address('Same St', 'Cologne', '50667');
        $user1   = new User('A', 'a@example.com');
        $user2   = new User('B', 'b@example.com');
        $user1->address = $address;
        $user2->address = $address;

        $this->em->persist($address);
        $this->em->persist($user1);
        $this->em->persist($user2);
        $this->em->flush();

        $this->em->clear();
        $a = $this->em->find(User::class, $user1->id);
        $b = $this->em->find(User::class, $user2->id);

        $addrA = $a->address;
        $addrB = $b->address;
        $this->assertSame($addrA, $addrB, 'Doctrine identity map must return same object');

        WireHelper::reset();
        WireHelper::extract(['user' => $a], ['user.address.city'], 'scope1');
        $result = WireHelper::extract(['user' => $b], ['user.address.city'], 'scope2');
        $this->assertArrayHasKey('$ref', $result['user']['address']);
    }
}
