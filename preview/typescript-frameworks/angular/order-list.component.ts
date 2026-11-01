import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  total: number;
  placedAt: string | null;
}

/**
 * Lists a customer's orders with client-side search.
 * TODO: replace the HTTP call with a resource() once it is stable.
 */
@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe, TitleCasePipe],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderListComponent {
  private readonly http = inject(HttpClient);

  @Input({ required: true }) customerId!: string;
  @Input() currency = 'USD';
  @Output() readonly selected = new EventEmitter<Order>();

  readonly query = signal('');
  readonly statusFilter = signal<OrderStatus | 'all'>('all');
  readonly page = signal(1);

  private readonly orders = toSignal(
    this.http
      .get<Order[]>('/api/orders', { params: new HttpParams().set('limit', 50) })
      .pipe(catchError(() => of([] as Order[]))),
    { initialValue: [] as Order[] },
  );

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.orders().filter(
      (o) => (status === 'all' || o.status === status) && o.number.toLowerCase().includes(q),
    );
  });

  readonly total = computed(() => this.visible().reduce((sum, o) => sum + o.total, 0));
  readonly isEmpty = computed(() => this.visible().length === 0);

  constructor() {
    effect(() => console.debug(`[orders] ${this.visible().length} visible, q="${this.query()}"`));
  }

  trackById = (_: number, order: Order): string => order.id;

  select(order: Order): void {
    this.selected.emit(order);
  }
}
