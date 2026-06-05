#!/bin/bash
# RFC-014 Migration Script: Move files to reflection/ and shared/
# Run from: packages/assessment-mcp/

set -e  # Exit on error

echo "🚀 Starting RFC-014 Migration..."
echo ""

# Check we're in the right directory
if [ ! -d "src/core" ]; then
    echo "❌ ERROR: Must run from packages/assessment-mcp/ directory"
    exit 1
fi

echo "📁 Phase 2: Moving files with git mv (preserves history)..."
echo ""

# Move reflection tools
echo "  → Moving reflection tools to src/reflection/..."
git mv src/core/aspect_analyzer.ts src/reflection/
git mv src/core/insights_writer.ts src/reflection/
git mv src/core/reflect_uncertainty.ts src/reflection/uncertainty_reviewer.ts

# Move shared utilities
echo "  → Moving shared utilities to src/shared/..."
git mv src/core/exam_config_reader.ts src/shared/
git mv src/core/exam_config_reader.js src/shared/
git mv src/core/rubric_parser.ts src/shared/
git mv src/core/rubric_parser.js src/shared/
git mv src/core/project_state_manager.ts src/shared/
git mv src/core/yaml_generator.ts src/shared/

echo ""
echo "✅ Phase 2 Complete: Files moved with git mv"
echo ""
echo "📝 Next steps:"
echo "   1. Run: npm run update-imports (will create this script next)"
echo "   2. Run: npm test"
echo "   3. Run: npm run build"
echo ""
echo "Files moved:"
echo "  Reflection (3 files):"
echo "    - aspect_analyzer.ts → reflection/"
echo "    - insights_writer.ts → reflection/"
echo "    - reflect_uncertainty.ts → reflection/uncertainty_reviewer.ts"
echo ""
echo "  Shared (6 files):"
echo "    - exam_config_reader.ts + .js → shared/"
echo "    - rubric_parser.ts + .js → shared/"
echo "    - project_state_manager.ts → shared/"
echo "    - yaml_generator.ts → shared/"
