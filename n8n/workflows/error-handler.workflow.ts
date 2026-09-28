import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const onFailure = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'On LifeLink Workflow Failure', position: [0, 200] },
  output: [{ execution: { id: '231', url: 'https://amitsingh7291.app.n8n.cloud/workflow/abc/executions/231', lastNodeExecuted: 'Compatibility Engine', error: { message: 'Something failed' }, mode: 'webhook' }, workflow: { id: 'abc', name: 'LifeLink – Emergency Blood Request Dispatch' } }]
});

const logFailure = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Log Workflow Failure',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: '9DOMxRSEX3x3sfqc', cachedResultName: 'lifelink_workflow_errors' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          workflow_name: expr('{{ $json.workflow?.name ?? "unknown" }}'),
          failed_node: expr('{{ $json.execution?.lastNodeExecuted ?? "unknown" }}'),
          error_message: expr('{{ $json.execution?.error?.message ?? "unknown error" }}'),
          execution_id: expr('{{ String($json.execution?.id ?? "") }}'),
          execution_url: expr('{{ $json.execution?.url ?? "" }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'workflow_name', displayName: 'workflow_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'failed_node', displayName: 'failed_node', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'error_message', displayName: 'error_message', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'execution_id', displayName: 'execution_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'execution_url', displayName: 'execution_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: {}
    },
    position: [260, 200]
  },
  output: [{ id: 1, workflow_name: 'LifeLink – Emergency Blood Request Dispatch', failed_node: 'Compatibility Engine', error_message: 'Something failed', execution_id: '231' }]
});

const note = sticky("## Shared error handler\nEvery LifeLink workflow sets this as its **Error workflow**. Any failed production run is recorded in **lifelink_workflow_errors** with the failed node, message and a link to the execution.\n\nTo page someone, add a Slack / email / Twilio node after the log step once a credential exists.", [onFailure, logFailure], { color: 3, position: [-40, -60], width: 520, height: 220 });

export default workflow('lifelink-error-handler', 'LifeLink – Error Handler')
  .add(onFailure)
  .to(logFailure)
  .add(note);
