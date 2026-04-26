<?php

namespace App\Tests\Integration;

use App\Entity\Address;
use App\Entity\Post;
use App\Entity\User;
use SoureCode\Wire\WireHelper;

class WireRelationshipTest extends WireIntegrationTestCase
{
    public function testManyToOneAddressExtracted(): void
    {
        $address = new Address('123 Main St', 'Berlin', '10115');
        $user    = new User('Jason', 'jason@example.com');
        $user->address = $address;

        $this->em->persist($address);
        $this->em->persist($user);
        $this->em->flush();

        $data = $this->wireData('wire_test/user_relations.html.twig', ['user' => $user]);
        $this->assertSame('Berlin', $data['user']['address']['city']);
        $this->assertSame('123 Main St', $data['user']['address']['street']);
    }

    public function testNullManyToOneProducesNoAddressKey(): void
    {
        $user = new User('NoAddr', 'noaddr@example.com');
        $this->em->persist($user);
        $this->em->flush();

        $data = $this->wireData('wire_test/user_relations.html.twig', ['user' => $user]);
        $this->assertArrayNotHasKey('address', $data['user'] ?? []);
    }

    public function testSameAddressSharedBetweenScopesProducesRef(): void
    {
        $address = new Address('Shared St', 'Hamburg', '20095');
        $user1   = new User('User1', 'u1@example.com');
        $user2   = new User('User2', 'u2@example.com');
        $user1->address = $address;
        $user2->address = $address;

        $this->em->persist($address);
        $this->em->persist($user1);
        $this->em->persist($user2);
        $this->em->flush();

        WireHelper::reset();
        WireHelper::extract(['user' => $user1], ['user.address.city'], 'scope1');
        $result = WireHelper::extract(['user' => $user2], ['user.address.city'], 'scope2');

        $this->assertArrayHasKey('$ref', $result['user']['address']);
    }

    public function testCircularRefPostAuthorDoesNotInfiniteLoop(): void
    {
        $user = new User('Author', 'author@example.com');
        $post = new Post('Hello Wire', $user);
        $user->posts->add($post);

        $this->em->persist($user);
        $this->em->persist($post);
        $this->em->flush();

        WireHelper::reset();
        WireHelper::extract(['user' => $user], ['user.name'], 'scope_user');
        $result = WireHelper::extract(['post' => $post], ['post.title', 'post.author.name'], 'scope_post');

        $this->assertSame('Hello Wire', $result['post']['title']);
        $this->assertArrayHasKey('$ref', $result['post']['author']);
        $this->assertStringStartsWith('scope_user#', $result['post']['author']['$ref']);
    }

    public function testSameObjectSharedWithinSingleExtractProducesRef(): void
    {
        $address = new Address('Loop St', 'Frankfurt', '60311');
        $user    = new User('Frank', 'frank@example.com');
        $user->address = $address;

        $this->em->persist($address);
        $this->em->persist($user);
        $this->em->flush();

        WireHelper::reset();
        $result = WireHelper::extract(
            ['user' => $user, 'addr' => $address],
            ['user.address.city', 'addr.city'],
            'scope1'
        );

        $this->assertArrayHasKey('$ref', $result['addr']);
    }
}
