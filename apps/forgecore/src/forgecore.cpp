#include "forgecore.hpp"

#include <algorithm>
#include <charconv>
#include <limits>
#include <map>
#include <set>
#include <sstream>
#include <string_view>

namespace forgecore {
namespace {

constexpr std::size_t kMaxTasks = 500;
constexpr std::size_t kMaxDependencies = 32;
constexpr std::size_t kMaxLineBytes = 4096;

bool valid_id(std::string_view id) {
    if (id.size() < 2 || id.size() > 64 || id[0] < 'a' || id[0] > 'z') return false;
    for (char c : id) {
        if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-')) return false;
    }
    return true;
}

std::uint32_t parse_positive(std::string_view text, std::uint32_t maximum, std::string_view field) {
    std::uint32_t value = 0;
    auto [end, error] = std::from_chars(text.data(), text.data() + text.size(), value);
    if (error != std::errc{} || end != text.data() + text.size() || value == 0 || value > maximum) {
        throw PlanError("invalid numeric field: " + std::string(field));
    }
    return value;
}

std::vector<std::string_view> split(std::string_view text, char delimiter) {
    std::vector<std::string_view> parts;
    std::size_t offset = 0;
    do {
        auto found = text.find(delimiter, offset);
        if (found == std::string_view::npos) {
            parts.push_back(text.substr(offset));
            break;
        }
        parts.push_back(text.substr(offset, found - offset));
        offset = found + 1;
    } while (true);
    return parts;
}

} // namespace

std::vector<Task> parse_tasks(std::istream& input) {
    std::vector<Task> tasks;
    std::set<std::string> ids;
    std::string line;
    std::size_t line_number = 0;
    while (std::getline(input, line)) {
        ++line_number;
        if (line.size() > kMaxLineBytes) throw PlanError("line exceeds 4096-byte budget");
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty() || line[0] == '#') continue;
        const auto parts = split(line, '|');
        if (parts.size() != 4 || !valid_id(parts[0])) {
            throw PlanError("invalid task record at line " + std::to_string(line_number));
        }
        Task task;
        task.id = parts[0];
        task.duration_ms = parse_positive(parts[1], 1'000'000, "duration_ms");
        task.memory_mib = parse_positive(parts[2], 4'096, "memory_mib");
        if (!ids.insert(task.id).second) throw PlanError("duplicate task id: " + task.id);
        if (parts[3] != "-") {
            auto names = split(parts[3], ',');
            if (names.size() > kMaxDependencies) throw PlanError("too many dependencies");
            std::set<std::string> deps;
            for (const auto dep : names) {
                if (!valid_id(dep)) throw PlanError("invalid dependency id");
                if (!deps.insert(std::string(dep)).second) throw PlanError("duplicate dependency");
                if (dep == task.id) throw PlanError("self dependency");
                task.depends_on.emplace_back(dep);
            }
        }
        tasks.push_back(std::move(task));
        if (tasks.size() > kMaxTasks) throw PlanError("more than 500 tasks");
    }
    if (input.bad()) throw PlanError("read error");
    if (tasks.empty()) throw PlanError("no tasks found");
    return tasks;
}

Plan build_plan(const std::vector<Task>& tasks, Limits limits) {
    if (limits.max_parallel < 1 || limits.max_parallel > 64 ||
        limits.memory_mib < 1 || limits.memory_mib > 4'096) throw PlanError("invalid resource limits");
    if (tasks.empty() || tasks.size() > kMaxTasks) throw PlanError("invalid task count");
    std::map<std::string, Task> remaining;
    for (const auto& t : tasks) {
        if (!valid_id(t.id) || t.duration_ms < 1 || t.duration_ms > 1'000'000 ||
            t.memory_mib < 1 || t.memory_mib > limits.memory_mib ||
            t.depends_on.size() > kMaxDependencies)
            throw PlanError("invalid task or task exceeds memory budget");
        if (!remaining.emplace(t.id, t).second) throw PlanError("duplicate task id");
    }
    for (const auto& [id, t] : remaining) {
        std::set<std::string> dep_ids;
        for (const auto& dep : t.depends_on) {
            if (!valid_id(dep) || dep == id || !dep_ids.insert(dep).second)
                throw PlanError("invalid dependency");
            if (remaining.find(dep) == remaining.end()) throw PlanError("unknown dependency: " + dep);
        }
    }
    const std::size_t total = remaining.size();
    std::set<std::string> completed;
    Plan plan;
    while (!remaining.empty()) {
        Wave wave;
        wave.starts_at_ms = plan.makespan_ms;
        std::uint32_t wave_duration = 0;
        for (const auto& [id, t] : remaining) {
            if (wave.tasks.size() == limits.max_parallel) break;
            if (!std::all_of(t.depends_on.begin(), t.depends_on.end(),
                             [&](const auto& dep) { return completed.contains(dep); })) continue;
            if (t.memory_mib > limits.memory_mib - wave.reserved_memory_mib) continue;
            wave.reserved_memory_mib += t.memory_mib;
            wave_duration = std::max(wave_duration, t.duration_ms);
            wave.tasks.push_back(id);
        }
        if (wave.tasks.empty()) throw PlanError("dependency cycle or unschedulable tasks");
        plan.makespan_ms += wave_duration;  // bounded by 500 * 1,000,000 ms
        wave.ends_at_ms = plan.makespan_ms;
        plan.peak_reserved_memory_mib = std::max(plan.peak_reserved_memory_mib, wave.reserved_memory_mib);
        for (const auto& id : wave.tasks) {
            completed.insert(id);
            remaining.erase(id);
        }
        plan.waves.push_back(std::move(wave));
    }
    plan.task_count = total;
    return plan;
}

std::string to_json(const Plan& plan) {
    std::ostringstream out;
    out << "{\"schema\":\"forgecore-deterministic-plan-v1\",\"executed\":false,"
        << "\"task_count\":" << plan.task_count << ",\"makespan_ms\":" << plan.makespan_ms
        << ",\"peak_reserved_memory_mib\":" << plan.peak_reserved_memory_mib << ",\"waves\":[";
    for (std::size_t i = 0; i < plan.waves.size(); ++i) {
        const auto& w = plan.waves[i];
        if (i) out << ',';
        out << "{\"starts_at_ms\":" << w.starts_at_ms << ",\"ends_at_ms\":" << w.ends_at_ms
            << ",\"reserved_memory_mib\":" << w.reserved_memory_mib << ",\"tasks\":[";
        for (std::size_t j = 0; j < w.tasks.size(); ++j) {
            if (j) out << ',';
            out << '"' << w.tasks[j] << '"'; // Validated IDs cannot contain JSON control chars.
        }
        out << "]}";
    }
    out << "]}";
    return out.str();
}

} // namespace forgecore
