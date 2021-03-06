const edge = require('edge');
const md = require('marked');

const getController = (data) => {
    const getTasksList = (req, res) => {
        data.tasks.getAll()
            .then((t) => {
                const context = {
                    tasks: t,
                    userTasks: req.user.tasks,
                    user: req.user,
                };
                res.render('tasks', context);
            });
    };
    const getCompilerForm = (req, res) => {
        const id = req.params.id;
        data.tasks.findById(id)
            .then((task) => {
                const sortedKeys = Object.keys(task.users)
                    .sort((a, b) => task.users[b] - task.users[a]);
                const context = {
                    task: task,
                    md: md,
                    sortedKeys: sortedKeys,
                    user: req.user,
                };
                return context;
            })
            .then((context) => {
                return res.render('compiler', context);
            })
            .catch((err) => {
                console.log(err);
            });
    };
    const postTaskSolution = (req, res) => {
        const id = req.params.id;
        const input = req.body;
        data.tasks.findById(id)
            .then((task) => {
                const boilerplate = edge.func(
                    `using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.IO;
using System.Diagnostics;
    
public class Startup
{
    static void FakeInput(object input)
    {
        Console.SetIn(new StringReader(input.ToString()));
    }
    
    public async Task<object> Invoke(object input)
    {
        FakeInput(input);
        using(var writer = new StringWriter())
        {
            Console.SetOut(writer);
            Console.Out.NewLine = "\\n";
            var sw = new Stopwatch();
            Process proc = Process.GetCurrentProcess();
            var task = Task.Factory.StartNew(() => Program.Main());
            sw.Start();
            task.Wait(${+task.timelimit});
            if (task.IsCompleted)
            {
                sw.Stop();
                writer.Flush();
                var result = writer.GetStringBuilder().ToString();
                return String.Format("{0} {1} {2:F2}", 
                sw.Elapsed, result, (proc.WorkingSet64 / (1024.0 * 1024) - 55));
            }
            else
            {
                sw.Stop();
                throw new TimeoutException(sw.Elapsed.ToString());
            }
        }
    }
    ${input}
}`);
                const results = [];
                for (let i = 0; i < task.input.length; i++) {
                    boilerplate(task.input[i].trim(), (error, result) => {
                        if (error) {
                            results.push({
                                status: 'failed',
                                reason: error.name,
                                message: error.message,
                            });
                        } else {
                            const current = result.trim().split(' ');
                            const message = `Time: ${current[0]}
                                 Memory: ${current[2]}MB`;
                            if (task.results[i].trim() ===
                                current[1].trim()) {
                                results.push({
                                    status: 'passed',
                                    reason: '',
                                    message: message,
                                });
                            } else {
                                results.push({
                                    status: 'failed',
                                    reason: 'wrong result',
                                    message: message,
                                });
                            }
                        }
                    });
                }
                const successCount = results
                    .filter((x) => x.status === 'passed').length;
                const submission = {
                    code: input,
                    result: successCount * 10,
                    date: new Date().toLocaleDateString(),
                };
                const user = req.user;
                if (user.tasks[task._id]) {
                    user.tasks[task._id].submissions.push(submission);
                    if (user.tasks[task._id]
                        .topResult.result < submission.result) {
                        user.tasks[task._id].topResult = submission;
                        task.users[user.username] = submission.result;
                        data.tasks.updateById(task);
                    }
                } else {
                    user.tasks[task._id] = {
                        submissions: [submission],
                        topResult: submission,
                    };
                    task.users[user.username] = submission.result;
                    data.tasks.updateById(task);
                }
                data.users.updateById(user);
                return results;
            })
            .then((results) => {
                res.send(results);
            })
            .catch((error) => {
                const message = error.message
                    .substring(0, error.message.indexOf('---->') - 1);
                res.send([{
                    status: 'failed',
                    reason: error.name,
                    message: message,
                }]);
            });
    };

    const getUserSubmissions = (req, res) => {
        const id = req.params.id;
        let submissions = {};
        let topResult = {};
        if (req.user.tasks[id]) {
            submissions = req.user.tasks[id].submissions;
            topResult = req.user.tasks[id].topResult;
        }
        const context = {
            id: id,
            user: req.user,
            submissions: submissions,
            topResult: topResult,
        };
        res.render('submissions', context);
    };
    return {
        getTasksList,
        getCompilerForm,
        postTaskSolution,
        getUserSubmissions,
    };
};

module.exports = { getController };
