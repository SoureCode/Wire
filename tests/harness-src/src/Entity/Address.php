<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
class Address
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    public int $id;

    #[ORM\Column(length: 255)]
    public string $street;

    #[ORM\Column(length: 100)]
    public string $city;

    #[ORM\Column(length: 20)]
    public string $zip;

    public function __construct(string $street, string $city, string $zip)
    {
        $this->street = $street;
        $this->city   = $city;
        $this->zip    = $zip;
    }
}
