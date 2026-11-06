#include "forgecore.hpp"

#include <exception>
#include <fstream>
#include <iostream>
#include <string_view>

int main(int argc, char** argv) {
    if (argc != 4) {
        std::cerr << "Usage: forgecore <task-fixture.tsv> <max-parallel> <memory-MiB>\n";
        return 2;
    }
    try {
        std::string_view cpu{argv[2]}, memory{argv[3]};
        auto parse = [](std::string_view v) -> std::uint32_t {
            if (v.empty() || v.size() > 5) throw forgecore::PlanError("invalid limit value");
            std::uint32_t num = 0;
            for (char c : v) {
                if (c < '0' || c > '9') throw forgecore::PlanError("invalid limit value");
                num = num * 10 + static_cast<std::uint32_t>(c - '0');
            }
            return num;
        };
        std::ifstream input{argv[1]};
        if (!input.is_open()) throw forgecore::PlanError("unable to open input fixture");
        const auto tasks = forgecore::parse_tasks(input);
        const auto plan = forgecore::build_plan(tasks, {parse(cpu), parse(memory)});
        std::cout << forgecore::to_json(plan) << '\n';
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "ForgeCore plan rejected: " << error.what() << '\n';
        return 1;
    }
}
