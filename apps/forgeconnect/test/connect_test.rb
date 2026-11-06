# frozen_string_literal: true

require 'minitest/autorun'
require_relative '../lib/forge_connect'

class ConnectTest < Minitest::Test
  def setup
    @hub = ForgeConnect.new(max_attempts: 2)
    @hub.add_tenant('acme', 'local-secret-32-bytes-minimum')
    @body = JSON.generate(id: 'e-1', topic: 'orders', payload: { state: 'created' })
  end

  def intake(body = @body, signature: @hub.sign('acme', body))
    @hub.receive(tenant: 'acme', raw_body: body, signature: signature)
  end

  def test_subscription_and_dedupe
    @hub.subscribe('orders', 'audit')
    @hub.subscribe('orders', 'audit')
    assert_equal :accepted, intake
    assert_equal :duplicate, intake
    assert_equal 1, @hub.queued
    assert_equal 1, @hub.seen_count
  end

  def test_fanout_to_two_consumers
    @hub.subscribe('orders', 'audit')
    @hub.subscribe('orders', 'warehouse')
    intake
    outputs = []
    assert_equal 2, @hub.drain { |job| outputs << job.subscriber; true }
    assert_equal %w[audit warehouse], outputs
    assert_equal 0, @hub.queued
  end

  def test_signature_rejection
    @hub.subscribe('orders', 'audit')
    assert_raises(ForgeConnect::Error) { intake(signature: '0' * 64) }
    assert_equal 0, @hub.seen_count
  end

  def test_tamper_detection
    @hub.subscribe('orders', 'audit')
    raise_body = @body.sub('created', 'shipped')
    assert_raises(ForgeConnect::Error) { @hub.receive(tenant: 'acme', raw_body: raise_body, signature: @hub.sign('acme', @body)) }
  end

  def test_validation
    assert_raises(ArgumentError) { ForgeConnect.new(max_attempts: 0) }
    assert_raises(ArgumentError) { @hub.subscribe('', 'x') }
    assert_raises(ForgeConnect::Error) { @hub.add_tenant('acme', 'same-secret-32-bytes-here') }
    assert_raises(ForgeConnect::Error) { intake('{oops') }
    assert_raises(ForgeConnect::Error) { intake(JSON.generate(topic: 'orders')) }
  end

  def test_queue_retries_then_dead_letters
    @hub.subscribe('orders', 'warehouse')
    intake
    assert_equal 1, @hub.drain { false }
    assert_equal 1, @hub.queued
    assert_equal 1, @hub.drain { false }
    assert_equal 0, @hub.queued
    assert_equal 1, @hub.dead_letters.size
    assert_equal 2, @hub.dead_letters.first.attempts
  end

  def test_recovery_after_transient_failure
    @hub.subscribe('orders', 'warehouse')
    intake
    @hub.drain { raise 'temporary' }
    assert_equal 1, @hub.queued
    @hub.drain { true }
    assert_equal 0, @hub.queued
    assert_empty @hub.dead_letters
  end

  def test_tenant_isolated_replay
    @hub.add_tenant('other', 'another-long-secret-32-bytes-here')
    @hub.subscribe('orders', 'audit')
    assert_equal :accepted, intake
    assert_equal :accepted, @hub.receive(tenant: 'other', raw_body: @body, signature: @hub.sign('other', @body))
    assert_equal 2, @hub.queued
  end

  def test_unknown_tenant
    assert_raises(ForgeConnect::Error) { @hub.receive(tenant: 'missing', raw_body: @body, signature: 'x') }
  end

  def test_no_subscribers_can_accept
    assert_equal :accepted, intake
    assert_equal 0, @hub.queued
  end

  def test_bad_limit
    assert_raises(ArgumentError) { @hub.drain(limit: 0) { true } }
  end

  def test_queue_limit
    @hub.subscribe('orders', 'audit')
    intake
    two = JSON.generate(id: 'e-2', topic: 'orders')
    intake(two)
    assert_equal 1, @hub.drain(limit: 1) { true }
    assert_equal 1, @hub.queued
  end
end
