# frozen_string_literal: true

require 'openssl'
require 'json'

# A local webhook intake / delivery queue. Trusted consumers only, no open HTTP listener.
class ForgeConnect
  class Error < StandardError; end
  Delivery = Struct.new(:tenant, :event_id, :topic, :payload, :subscriber, :attempts, keyword_init: true)

  def initialize(max_attempts: 3)
    raise ArgumentError, 'max_attempts must be 1..10' unless (1..10).cover?(max_attempts)

    @max_attempts = max_attempts
    @secrets = {}
    @subscribers = Hash.new { |h, k| h[k] = [] }
    @seen = {}
    @queue = []
    @dead_letter = []
  end

  def add_tenant(tenant, secret)
    raise ArgumentError, 'tenant and secret required' if tenant.to_s.empty? || secret.to_s.bytesize < 16
    raise Error, 'tenant already exists' if @secrets.key?(tenant)

    @secrets[tenant] = secret
  end

  def subscribe(topic, name)
    raise ArgumentError, 'topic and name required' if topic.to_s.empty? || name.to_s.empty?

    @subscribers[topic] << name unless @subscribers[topic].include?(name)
  end

  def sign(tenant, raw_body)
    secret = @secrets.fetch(tenant) { raise Error, 'unknown tenant' }
    OpenSSL::HMAC.hexdigest('SHA256', secret, raw_body)
  end

  def receive(tenant:, raw_body:, signature:)
    expected = sign(tenant, raw_body)
    raise Error, 'signature mismatch' unless secure_compare(expected, signature.to_s)
    raise Error, 'oversized message' if raw_body.bytesize > 32_768

    data = JSON.parse(raw_body)
    raise Error, 'invalid event' unless data.is_a?(Hash)
    event_id = data.fetch('id').to_s
    topic = data.fetch('topic').to_s
    raise Error, 'missing event identity' if event_id.empty? || topic.empty?

    unique = [tenant, event_id]
    return :duplicate if @seen[unique]

    targets = @subscribers.fetch(topic, [])
    targets.each do |subscriber|
      @queue << Delivery.new(tenant: tenant, event_id: event_id, topic: topic,
                             payload: data['payload'], subscriber: subscriber, attempts: 0)
    end
    @seen[unique] = true
    :accepted
  rescue JSON::ParserError, KeyError, TypeError
    raise Error, 'invalid JSON event'
  end

  # Handler takes a Delivery and returns true on successful send; failures are retried, then dead-lettered.
  def drain(limit: 100)
    raise ArgumentError, 'limit must be positive' unless limit.is_a?(Integer) && limit.positive?
    processed = 0
    [limit, @queue.size].min.times do
      delivery = @queue.shift
      success = begin
        (yield delivery) == true
      rescue StandardError
        false
      end
      processed += 1
      next if success

      delivery.attempts += 1
      if delivery.attempts >= @max_attempts
        @dead_letter << delivery
      else
        @queue << delivery
      end
    end
    processed
  end

  def queued = @queue.size
  def dead_letters = @dead_letter.map(&:dup)
  def seen_count = @seen.size

  private

  def secure_compare(a, b)
    return false unless a.bytesize == b.bytesize

    bytes = a.bytes.zip(b.bytes)
    bytes.reduce(0) { |diff, (x, y)| diff | (x ^ y) }.zero?
  end
end
