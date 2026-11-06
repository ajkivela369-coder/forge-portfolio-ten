#include "forgecore.hpp"
#include <functional>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace forgecore;

namespace {
int passed = 0;
int failed = 0;

void require(bool ok, const std::string& note) {
    if (!ok) throw std::runtime_error(note);
}
void named(const std::string& title, const std::function<void()>& fn) {
    try { fn(); ++passed; std::cout << "PASS " << title << '\n'; }
    catch (const std::exception& ex) { ++failed; std::cerr << "FAIL " << title << ": " << ex.what() << '\n'; }
}
void rejects(const std::string& source, const std::string& expected_part) {
    std::istringstream stream{source};
    try { (void)build_plan(parse_tasks(stream), {2, 256}); }
    catch (const PlanError& error) {
        require(std::string(error.what()).find(expected_part) != std::string::npos,
                "wrong rejection reason: " + std::string(error.what()));
        return;
    }
    throw std::runtime_error("expected rejection");
}
std::string valid = "fetch-data|40|128|-\n"
                    "parse-data|25|64|fetch-data\n"
                    "write-index|80|64|fetch-data\n"
                    "finish-job|20|128|parse-data,write-index\n";
}

int main() {
    named("parses valid dependency format", [] {
        std::istringstream input{valid};
        auto tasks = parse_tasks(input);
        require(tasks.size() == 4, "task count");
        require(tasks[3].depends_on.size() == 2, "dependency count");
    });
    named("builds correct dependency and resource-aware waves", [] {
        std::istringstream input{valid};
        auto plan = build_plan(parse_tasks(input), {2, 256});
        require(plan.waves.size() == 3, "three waves expected");
        require(plan.waves[0].tasks == std::vector<std::string>{"fetch-data"}, "wave 1");
        require(plan.waves[1].tasks == (std::vector<std::string>{"parse-data", "write-index"}), "wave 2");
        require(plan.waves[2].tasks == std::vector<std::string>{"finish-job"}, "wave 3");
        require(plan.makespan_ms == 140, "makespan");
        require(plan.peak_reserved_memory_mib == 128, "peak memory");
    });
    named("input order does not change output JSON", [] {
        std::istringstream a{valid};
        std::istringstream b{"finish-job|20|128|parse-data,write-index\nwrite-index|80|64|fetch-data\nfetch-data|40|128|-\nparse-data|25|64|fetch-data\n"};
        require(to_json(build_plan(parse_tasks(a),{2,256})) == to_json(build_plan(parse_tasks(b),{2,256})), "determinism");
    });
    named("serial mode schedules independent tasks separately", [] {
        std::istringstream input{"bravo|9|10|-\nalpha|5|10|-\n"};
        auto plan = build_plan(parse_tasks(input), {1, 64});
        require(plan.waves.size() == 2, "two serial waves");
        require(plan.waves[0].tasks[0] == "alpha", "stable lexicographic selection");
        require(plan.makespan_ms == 14, "sum of durations");
    });
    named("memory pressure defers otherwise ready tasks", [] {
        std::istringstream input{"alpha|10|70|-\nbravo|20|70|-\n"};
        auto plan = build_plan(parse_tasks(input), {2, 100});
        require(plan.waves.size() == 2, "two waves due to memory cap");
        require(plan.peak_reserved_memory_mib == 70, "peak memory is bounded");
    });
    named("missing dependency is rejected", [] { rejects("alpha|10|20|missing-dep\n", "unknown dependency"); });
    named("cycle is rejected", [] { rejects("alpha|10|20|bravo\nbravo|10|20|alpha\n", "cycle"); });
    named("duplicate id is rejected", [] { rejects("alpha|10|20|-\nalpha|10|20|-\n", "duplicate task"); });
    named("self dependency is rejected", [] { rejects("alpha|10|20|alpha\n", "self dependency"); });
    named("duplicate dependency is rejected", [] { rejects("alpha|10|20|bravo,bravo\nbravo|10|20|-\n", "duplicate dependency"); });
    named("oversized task cannot silently exceed memory cap", [] { rejects("alpha|10|400|-\n", "exceeds memory budget"); });
    named("invalid numeric fields reject zero and overflow", [] {
        rejects("alpha|0|10|-\n", "invalid numeric");
        rejects("alpha|10|99999999|-\n", "invalid numeric");
        rejects("alpha|-2|20|-\n", "invalid numeric");
    });
    named("malformed input, injection and extra separators rejected", [] {
        rejects("../secret|10|20|-\n", "invalid task record");
        rejects("alpha|10|20|-|shell\n", "invalid task record");
    });
    named("case-normalized IDs not silently allowed", [] { rejects("Upper|10|20|-\n", "invalid task record"); });
    named("resource policy options reject invalid values", [] {
        std::istringstream input{"alpha|10|20|-\n"};
        const auto tasks = parse_tasks(input);
        try { (void)build_plan(tasks, {0,64}); } catch (const PlanError&) { return; }
        throw std::runtime_error("bad CPU limit accepted");
    });
    named("empty and comment-only inputs rejected", [] { rejects("# comment\n", "no tasks"); });
    named("max line-size rejects overlength data", [] { rejects("alpha|10|20|-"+std::string(5000,'x')+"\n", "4096-byte"); });
    named("JSON reports not-executed and reconciled task count", [] {
        std::istringstream input{valid};
        auto json = to_json(build_plan(parse_tasks(input), {2,256}));
        require(json.find("\"executed\":false") != std::string::npos, "must not claim execution");
        require(json.find("\"task_count\":4") != std::string::npos, "task count");
    });
    named("task waves never run dependencies within same batch", [] {
        std::istringstream input{"alpha|1|1|-\nbravo|1|1|alpha\ncharlie|1|1|bravo\n"};
        auto plan = build_plan(parse_tasks(input), {3,64});
        require(plan.waves.size()==3, "transitive dependency needs 3 waves");
    });
    std::cout << "RESULT " << passed << " passed " << failed << " failed\n";
    return failed ? 1 : 0;
}
