<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity]
#[ORM\Table(name: '`user`')]
class User
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    public int $id;

    #[ORM\Column(length: 255)]
    #[Groups(['wire'])]
    public string $name;

    #[ORM\Column(length: 255)]
    #[Groups(['wire'])]
    public string $email;

    #[ORM\Column(length: 50)]
    #[Groups(['wire'])]
    public string $status = 'active';

    #[ORM\ManyToOne(targetEntity: Address::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['wire'])]
    public ?Address $address = null;

    #[ORM\OneToMany(targetEntity: Post::class, mappedBy: 'author')]
    public Collection $posts;

    public function __construct(string $name, string $email, string $status = 'active')
    {
        $this->name   = $name;
        $this->email  = $email;
        $this->status = $status;
        $this->posts  = new ArrayCollection();
    }
}
