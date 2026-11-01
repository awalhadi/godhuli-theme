import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { Product } from '../products/product.entity';
import type { CreateOrderDto } from './orders.controller';

export interface Page<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly hasNext: boolean;
}

type PaginateOptions<E extends { status: unknown }> = {
  page: number;
  perPage: number;
} & Partial<Pick<E, 'status'>>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private static readonly TAX_RATE = 0.075 as const;

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  async paginate({ page, perPage, status }: PaginateOptions<Order>): Promise<Page<Order>> {
    const where: FindOptionsWhere<Order> = status ? { status } : {};
    const [items, total] = await this.orderRepo.findAndCount({
      where,
      relations: { lines: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return { items, total, page, hasNext: page * perPage < total };
  }

  findById(id: string): Promise<Order | null> {
    return this.orderRepo.findOne({ where: { id }, relations: ['lines', 'lines.product'] });
  }

  /**
   * Creates an order inside a transaction.
   * @throws UnprocessableEntityException when a SKU is unknown
   */
  async create(dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const skus = dto.lines.map(({ sku }) => sku);
      const products = await manager.findBy(Product, { sku: In(skus), active: true });
      const bySku = new Map(products.map((p) => [p.sku, p] as const));

      const missing = skus.filter((s) => !bySku.has(s));
      if (missing.length > 0) {
        throw new UnprocessableEntityException(`Unknown SKUs: ${missing.join(', ')}`);
      }

      const subtotal = dto.lines.reduce((sum, l) => sum + bySku.get(l.sku)!.priceCents * l.quantity, 0);
      // FIXME: rounding should use banker's rounding for EUR invoices
      const order = manager.create(Order, {
        currency: dto.currency,
        status: OrderStatus.Pending,
        totalCents: Math.round(subtotal * (1 + OrdersService.TAX_RATE)),
        lines: dto.lines.map((l) => ({ product: bySku.get(l.sku), quantity: l.quantity })),
      });

      const saved = await manager.save(order);
      this.events.emit('order.created', { id: saved.id, total: saved.totalCents });
      this.logger.log(`Created order ${saved.id} with ${dto.lines.length} line(s)`);
      return saved;
    });
  }
}
