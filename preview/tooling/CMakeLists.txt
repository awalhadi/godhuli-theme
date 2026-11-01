# Godhuli Shop — native receipt printer & report tools
cmake_minimum_required(VERSION 3.25)

project(GodhuliShop
  VERSION 2.4.1
  DESCRIPTION "Native tooling for Godhuli Shop"
  LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(GODHULI_BUILD_TESTS "Build unit tests" ON)
option(GODHULI_USE_SANITIZERS "Enable ASan/UBSan in Debug" OFF)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

find_package(PostgreSQL 16 REQUIRED)
find_package(fmt 10.2 CONFIG REQUIRED)
find_package(Threads REQUIRED)

add_library(godhuli_core STATIC
  src/money.cpp
  src/order.cpp
  src/receipt.cpp)
add_library(Godhuli::core ALIAS godhuli_core)

target_include_directories(godhuli_core
  PUBLIC  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
          $<INSTALL_INTERFACE:include>
  PRIVATE ${PostgreSQL_INCLUDE_DIRS})

target_link_libraries(godhuli_core
  PUBLIC  fmt::fmt
  PRIVATE PostgreSQL::PostgreSQL Threads::Threads)

target_compile_definitions(godhuli_core PUBLIC
  GODHULI_VERSION="${PROJECT_VERSION}"
  $<$<CONFIG:Debug>:GODHULI_DEBUG=1>)

target_compile_options(godhuli_core PRIVATE
  $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall -Wextra -Wpedantic>
  $<$<CXX_COMPILER_ID:MSVC>:/W4 /permissive->
  $<$<AND:$<CONFIG:Debug>,$<BOOL:${GODHULI_USE_SANITIZERS}>>:-fsanitize=address,undefined>)

add_executable(order-report tools/order_report.cpp)
target_link_libraries(order-report PRIVATE Godhuli::core)

if(GODHULI_BUILD_TESTS)
  enable_testing()
  include(FetchContent)
  FetchContent_Declare(googletest
    URL https://github.com/google/googletest/archive/refs/tags/v1.15.2.tar.gz)
  FetchContent_MakeAvailable(googletest)

  foreach(name IN ITEMS money order receipt)
    add_executable(test_${name} tests/test_${name}.cpp)
    target_link_libraries(test_${name} PRIVATE Godhuli::core GTest::gtest_main)
    add_test(NAME ${name} COMMAND test_${name})
  endforeach()
endif()

install(TARGETS godhuli_core order-report
  EXPORT GodhuliTargets
  RUNTIME DESTINATION bin
  ARCHIVE DESTINATION lib)

message(STATUS "Godhuli Shop ${PROJECT_VERSION} (${CMAKE_BUILD_TYPE})")
