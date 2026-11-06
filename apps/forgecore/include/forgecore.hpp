#pragma once

#include <cstdint>
#include <istream>
#include <stdexcept>
#include <string>
#include <vector>

namespace forgecore {

struct Task {
    std::string id;
    std::uint32_t duration_ms{};
    std::uint32_t memory_mib{};
    std::vector<std::string> depends_on;
};

struct Limits {
    std::uint32_t max_parallel{2};
    std::uint32_t memory_mib{512};
};

struct Wave {
    std::uint64_t starts_at_ms{};
    std::uint64_t ends_at_ms{};
    std::uint32_t reserved_memory_mib{};
    std::vector<std::string> tasks;
};

struct Plan {
    std::vector<Wave> waves;
    std::uint64_t makespan_ms{};
    std::uint32_t peak_reserved_memory_mib{};
    std::size_t task_count{};
};

class PlanError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

std::vector<Task> parse_tasks(std::istream& input);
Plan build_plan(const std::vector<Task>& tasks, Limits limits);
std::string to_json(const Plan& plan);

} // namespace forgecore
