<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use SoureCode\Wire\WireHelper;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/wire-test')]
class WireTestController extends AbstractController
{
    #[Route('/user/{id}', name: 'wire_test_user')]
    public function user(int $id, EntityManagerInterface $em): Response
    {
        $user = $em->find(User::class, $id);
        if (!$user) {
            throw $this->createNotFoundException();
        }

        WireHelper::reset();

        return $this->render('wire_test/user.html.twig', ['user' => $user]);
    }

    #[Route('/fixture', name: 'wire_test_fixture', methods: ['GET'])]
    public function fixture(EntityManagerInterface $em): Response
    {
        $schemaTool = new SchemaTool($em);
        $schemaTool->createSchema([
            $em->getClassMetadata(User::class),
        ]);

        $user = new User('Jason', 'jason@example.com', 'active');
        $em->persist($user);
        $em->flush();

        return $this->redirectToRoute('wire_test_user', ['id' => $user->id]);
    }
}
