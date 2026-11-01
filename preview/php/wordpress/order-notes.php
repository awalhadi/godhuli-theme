<?php
/**
 * Plugin Name:       Order Notes for WooCommerce
 * Plugin URI:        https://example.com/plugins/order-notes
 * Description:       Lets shop managers pin internal notes to orders.
 * Version:           1.3.0
 * Requires PHP:      8.1
 * Author:            Godhuli Studio
 * License:           GPL-2.0-or-later
 * Text Domain:       order-notes
 */

defined( 'ABSPATH' ) || exit;

const ORDER_NOTES_TABLE = 'order_pinned_notes';

/**
 * Create the notes table on activation.
 *
 * @return void
 */
register_activation_hook( __FILE__, function (): void {
	global $wpdb;
	$table   = $wpdb->prefix . ORDER_NOTES_TABLE;
	$charset = $wpdb->get_charset_collate();

	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	dbDelta( "CREATE TABLE {$table} (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		order_id bigint(20) unsigned NOT NULL,
		note text NOT NULL,
		pinned tinyint(1) DEFAULT 0,
		PRIMARY KEY  (id)
	) {$charset};" );
} );

/**
 * Fetch pinned notes for an order.
 *
 * @param int $order_id WooCommerce order ID.
 * @return array<int, object>
 */
function order_notes_get_pinned( int $order_id ): array {
	global $wpdb;
	$table = $wpdb->prefix . ORDER_NOTES_TABLE;

	return $wpdb->get_results(
		$wpdb->prepare( "SELECT id, note FROM {$table} WHERE order_id = %d AND pinned = %d", $order_id, 1 )
	) ?: [];
}

add_action( 'woocommerce_admin_order_data_after_order_details', function ( WC_Order $order ): void {
	$notes = order_notes_get_pinned( $order->get_id() );

	printf( '<h3>%s</h3>', esc_html__( 'Pinned notes', 'order-notes' ) );
	foreach ( $notes as $note ) {
		echo '<p class="pinned-note">' . esc_html( wp_trim_words( $note->note, 40, '&hellip;' ) ) . '</p>';
	}
}, 20 );

// FIXME: this filter runs on every admin page; scope it to the orders screen
add_filter( 'admin_body_class', static fn ( string $classes ): string => $classes . ' has-order-notes' );

add_filter( 'woocommerce_order_actions', function ( array $actions ): array {
	$actions['order_notes_clear'] = __( 'Clear pinned notes', 'order-notes' );
	return $actions;
}, 10, 1 );
