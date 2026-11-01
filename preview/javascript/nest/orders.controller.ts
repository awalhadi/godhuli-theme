import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from './orders.service';

export enum Currency {
  USD = 'usd',
  EUR = 'eur',
}

export class OrderLineDto {
  @IsString()
  @Matches(/^[A-Z]{3}-\d{4,6}$/, { message: 'sku must look like "ACM-1042"' })
  readonly sku!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  readonly quantity: number = 1;
}

export class CreateOrderDto {
  @IsEnum(Currency)
  readonly currency: Currency = Currency.USD;

  @IsOptional()
  @IsString()
  readonly couponCode?: string | null = null;

  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => OrderLineDto)
  readonly lines!: OrderLineDto[];
}

/** REST endpoints for customer orders. */
@Controller({ path: 'orders', version: '1' })
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('status') status?: 'pending' | 'paid' | 'shipped',
  ) {
    return this.orders.paginate({ page, status, perPage: 20 });
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundException(`Order "${id}" does not exist`);
    return order;
  }

  // TODO: accept an Idempotency-Key header to avoid double submissions
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }
}
