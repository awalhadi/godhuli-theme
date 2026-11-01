<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Product;
use App\Form\ProductReviewType;
use App\Repository\ProductRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bridge\Doctrine\Attribute\MapEntity;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/products', name: 'product_')]
final class ProductController extends AbstractController
{
    public function __construct(
        private readonly ProductRepository $products,
        private readonly EntityManagerInterface $em,
    ) {}

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(
        #[MapQueryParameter] int $page = 1,
        #[MapQueryParameter] ?string $q = null,
    ): Response {
        $paginator = $this->products->search(term: $q, page: max(1, $page), perPage: 24);

        return $this->render('product/index.html.twig', [
            'products' => $paginator,
            'query' => $q,
        ]);
    }

    /**
     * Product detail page with an inline review form.
     */
    #[Route('/{slug}', name: 'show', requirements: ['slug' => '[a-z0-9-]+'], methods: ['GET', 'POST'])]
    public function show(
        #[MapEntity(mapping: ['slug' => 'slug'])] Product $product,
        Request $request,
    ): Response {
        $form = $this->createForm(ProductReviewType::class);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $review = $form->getData()->setProduct($product)->setAuthor($this->getUser());
            $this->em->persist($review);
            $this->em->flush();

            $this->addFlash('success', sprintf('Thanks for reviewing "%s"!', $product->getName()));
            return $this->redirectToRoute('product_show', ['slug' => $product->getSlug()]);
        }

        // TODO: cache related products per category for 10 minutes
        return $this->render('product/show.html.twig', [
            'product' => $product,
            'related' => $this->products->findRelated($product, limit: 4),
            'form' => $form,
        ]);
    }

    #[Route('/{id<\d+>}/archive', name: 'archive', methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    public function archive(Product $product): Response
    {
        $product->setArchived(true);
        $this->em->flush();

        return $this->json(['id' => $product->getId(), 'archived' => true, 'error' => null]);
    }
}
