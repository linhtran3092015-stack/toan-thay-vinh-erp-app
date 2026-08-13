begin;

select plan(9);

select is(
  (
    select operating_cost_vnd
    from public.get_finance_order_operating_cost('renewal', 'sandbox', 'sandbox_partner', 2800001)
  ),
  560000::bigint,
  'renewal SB uses 20 percent and floors a non-even VND result using integer arithmetic'
);

select is(
  (
    select operating_cost_vnd
    from public.get_finance_order_operating_cost('renewal', 'mma', 'mma_fanpage', 2800001)
  ),
  0::bigint,
  'renewal MMA has an explicit configured zero operating cost'
);

select is(
  (
    select operating_cost_vnd
    from public.get_finance_order_operating_cost('new_enrollment', 'sandbox', 'sandbox_partner', 2800001)
  ),
  1400000::bigint,
  'new-enrollment SB uses 700000 plus 25 percent with integer-VND rounding'
);

select is(
  (
    select status
    from public.get_finance_order_operating_cost('new_enrollment', 'mma', 'mma_fanpage', 2800000)
  ),
  'unconfigured',
  'new-enrollment MMA remains explicitly unconfigured'
);

select is(
  (
    select operating_cost_vnd
    from public.get_finance_order_operating_cost('new_enrollment', 'mma', 'mma_fanpage', 2800000)
  ),
  null::bigint,
  'an unconfigured policy returns NULL rather than silently becoming zero VND'
);

select is(
  (
    select status
    from public.get_finance_order_operating_cost('renewal', 'sandbox', 'sb_f1', 2800000)
  ),
  'unconfigured',
  'SB F1 remains explicitly unconfigured until its policy and settlement grouping are approved'
);

select is(
  public.get_finance_order_settlement_period('2026-08-10 16:59:59+00'),
  1::smallint,
  'period 1 ends at the local end of day on the 10th'
);

select is(
  public.get_finance_order_settlement_period('2026-08-10 17:00:00+00'),
  2::smallint,
  'period 2 begins at local midnight on the 11th'
);

select is(
  public.get_finance_order_settlement_period('2026-08-20 17:00:00+00'),
  3::smallint,
  'period 3 begins at local midnight on the 21st'
);

select * from finish();

rollback;
