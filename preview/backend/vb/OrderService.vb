Option Strict On
Option Infer On

Imports System.Net.Http
Imports System.Text.RegularExpressions
Imports System.Threading.Tasks

Namespace Godhuli.Shop.Orders

    Public Enum OrderStatus
        Pending = 0
        Paid = 1
        Shipped = 2
        Cancelled = &H10
    End Enum

    ''' <summary>
    ''' Coordinates order lookups and status updates.
    ''' </summary>
    Public Class OrderService
        Private Const MaxPageSize As Integer = 100
        Private Const TaxRate As Decimal = 0.0825D
        Private Shared ReadOnly SkuPattern As New Regex("^[A-Z]{3}-\d{5}$")

        Private ReadOnly _orders As New List(Of Order)()
        Private ReadOnly _http As HttpClient

        Public Property Region As String = "us-east"
        Public ReadOnly Property Count As Integer
            Get
                Return _orders.Count
            End Get
        End Property

        Public Sub New(http As HttpClient)
            _http = If(http, New HttpClient())
        End Sub

        ''' <summary>Returns open orders over the given amount.</summary>
        ''' <param name="minTotal">Minimum order total in USD.</param>
        Public Function LargeOpenOrders(minTotal As Decimal) As IEnumerable(Of Order)
            Return From o In _orders
                   Where o.Status <> OrderStatus.Shipped AndAlso o.Total >= minTotal
                   Order By o.Total Descending
                   Take MaxPageSize
        End Function

        Public Async Function SyncStatusAsync(orderId As Integer) As Task(Of Boolean)
            Dim order = _orders.FirstOrDefault(Function(o) o.Id = orderId)
            If order Is Nothing Then Return False

            Try
                ' TODO: move the base URL into configuration
                Dim url = $"https://fulfilment.godhuli.io/{Region}/orders/{orderId}"
                Dim body = Await _http.GetStringAsync(url)
                order.Status = If(body.Contains("""shipped"""), OrderStatus.Shipped, order.Status)
                Return True
            Catch ex As HttpRequestException
                Console.Error.WriteLine("Sync failed for #{0}: {1}", orderId, ex.Message)
                Return False
            End Try
        End Function

        Public Shared Function IsValidSku(sku As String) As Boolean
            Return Not String.IsNullOrWhiteSpace(sku) AndAlso SkuPattern.IsMatch(sku)
        End Function
    End Class

    Public Class Order
        Public Property Id As Integer
        Public Property Subtotal As Decimal
        Public Property Status As OrderStatus = OrderStatus.Pending
        Public ReadOnly Property Total As Decimal
            Get
                Return Math.Round(Subtotal * (1D + 0.0825D), 2)
            End Get
        End Property
    End Class

End Namespace
